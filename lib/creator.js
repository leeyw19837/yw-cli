import {fetchRepoList} from './request.js';
import {loading, loadModule, writeFileTree, injectImports, getConfigurations} from './utils.js';
import downloadGitRepo from 'download-git-repo';
import inquirer from 'inquirer';
import chalk from 'chalk';
import util from 'util';
import userhome from 'userhome';
import path from 'path';
import fs from 'fs-extra';
import PromptModuleApi from './prompt-api.js';
import {glob} from 'glob';
import GeneratorApi from './generator-api.js';
import {isBinaryFile} from 'isbinaryfile';
import vueCodeMod from 'vue-codemod';
import {execa} from 'execa';

const {runTransformation} = vueCodeMod;

const configurations = getConfigurations();

const defaultFeaturePrompt = {
    name: 'features',
    type: 'checkbox',
    message: '请选择项目的特性',
    choices: [],
};

class Creator {
    constructor(projectName, targetDir, promptFeatures) {
        // 项目名称
        this.name = projectName;
        // 模板目录
        this.templateDir = null;
        // 项目目录
        this.dir = targetDir;
        // 将downloadGitRepo转成promise
        this.downloadGitRepo = util.promisify(downloadGitRepo);
        this.promptFeatures = promptFeatures;
        // 特性的选择，之后他的choices会被一个一个插件填充
        this.featurePrompts = defaultFeaturePrompt;
        // 被注入的插件的选择框
        this.injectPrompts = [];
        // 被注入的选择完成的回调
        this.promptCompleteCbs = [];
        // 所选择的答案
        this.projectOptions = null;
        // 启用的插件
        this.plugins = [];
        // package.json的内容
        this.pkg = null;
        // 文件处理的中间件数组
        this.fileMiddleWares = [];
        // 需要插入的import语句
        this.imports = {};
        // key：文件路径 value：文件内容 插件在执行过程中生成的文件都会记录在这，最后统一写入硬盘
        this.files = {};
    }

    // 加载特性
    async loadFeatures() {
        const promptModuleApi = new PromptModuleApi(this);
        const modules = await Promise.all(this.promptFeatures);
        modules.forEach((module) => {
            module.default(promptModuleApi);
        });
    }

    // 特性选择
    async promptAndResolve() {
        const prompts = [this.featurePrompts, ...this.injectPrompts];
        const answers = await inquirer.prompt(prompts);
        const projectOptions = {};
        this.promptCompleteCbs.forEach((cb) => cb(answers, projectOptions));
        return projectOptions;
    }

    fetchRepo = async () => {
        const branches = await loading(fetchRepoList, 'waiting for fetch resources');
        return branches;
    }

    fetchTag = () => {
    }

    download = async (branch) => {
        // 拼接下载路径 这里放自己的模板仓库url
        const requestUrl = `rippi-cli-template/react/#${branch}`;
        // 把资源下载到指定的本地磁盘的文件夹
        const localCacheFolder = userhome('InterviewProjects');
        // 指定文件夹的模板的路径
        this.templateDir = path.join(localCacheFolder, 'scaffold', 'react', 'react+js')
        console.log('this.templateDir = ', this.templateDir)
        // 判断是否已经下载过该模板
        const hasDownloaded = fs.existsSync(this.templateDir);
        if (true) {
            await this.downloadGitRepo(requestUrl, this.templateDir);
            console.log(chalk.green('模板准备完成!'));
        }
    }

    // 把当期项目中的文件全部写入到this.files中，等待被改写或者处理
    async initFiles() {
        const projectFiles = await glob('**/*', {cwd: this.dir, nodir: true});
        for (let i = 0; i < projectFiles.length; i++) {
            const projectFile = projectFiles[i];
            const projectFilePath = path.join(this.dir, projectFile);
            let content;
            if (await isBinaryFile(projectFilePath)) {
                content = await fs.readFile(projectFilePath);
            } else {
                content = await fs.readFile(projectFilePath, 'utf8');
            }
            const curFileName = projectFile.split('\\').join('/');
            this.files[curFileName] = content;
        }
    }

    // 解析和收集插件
    async resolvedPlugins(rawPlugins) {
        const plugins = [];
        for (const id of Reflect.ownKeys(rawPlugins || {})) {
            // 插件的generator文件是在项目的node_modules的，所以以项目的package.json为基准来require
            const apply = loadModule(`${id}/generator`, this.dir);
            // 插件的配置的选项{ routerMode: 'hash/history' }
            const options = rawPlugins[id];
            plugins.push({id, apply, options});
        }
        return plugins;
    }

    // 应用插件
    async applyPlugins(plugins) {
        for (const plugin of plugins) {
            const {id, apply, options} = plugin;
            const generatorApi = new GeneratorApi(id, this, options);
            await apply(generatorApi, options);
        }
    }

    // 执行中间件
    async renderFiles() {
        const {files, projectOptions, fileMiddleWares} = this;
        for (const middleWare of fileMiddleWares) {
            console.dir(middleWare);
            await middleWare(files, projectOptions);
        }
        Reflect.ownKeys(files).forEach((file) => {
            const imports = this.imports[file];
            if (imports && imports.length > 0) {
                files[file] = runTransformation(
                    {path: file, source: files[file]},
                    injectImports,
                    {imports},
                );
            }
        });
    }

    create = async () => {
        await this.loadFeatures();
        const projectOptions = await this.promptAndResolve();
        (configurations.plugins ?? []).forEach((outerPlugin) => {
            projectOptions.plugins[outerPlugin] = {};
        });
        this.projectOptions = projectOptions;
        // 1 先去拉取当前仓库下的所有分支
        const branches = await this.fetchRepo();
        const {curBranch} = await inquirer.prompt([
            {
                name: 'curBranch',
                type: 'list',
                // 提示信息
                message: 'please choose current version:',
                // 选项
                choices: branches
                    .filter((branch) => branch.name !== 'main')
                    .map((branch) => ({
                        name: branch.name,
                        value: branch.name,
                    })),
            },
        ]);
        // 2 下载
        await this.download(curBranch);
        // return;
        // 3 将模板复制到目标目录
        // await fs.copy(this.templateDir, this.dir);
        // 读取项目目录的package.json的内容
        const pkgPath = path.join(this.dir, 'package.json');
        const pkg = (this.pkg = await fs.readJSON(pkgPath));
        // 4 初始化files对象
        await this.initFiles();
        // 5 下载内部插件 Reflect.ownKeys和Object.keys一样的
        const pluginDeps = Reflect.ownKeys(projectOptions.plugins || {});
        // 执行命令的参数
        const orderConfig = {cwd: this.dir, stdio: 'inherit'};
        // 安装依赖 这里就把插件都下载到项目目录里去了
        pluginDeps.forEach((dep) => pkg.devDependencies[dep] = 'latest');
        await execa('npm', ['install', ...pluginDeps, '-D'], orderConfig);
        // 6 解析和收集插件
        const resolvedPlugins = await this.resolvedPlugins(projectOptions.plugins);
        // 7 执行插件
        // 7.1 执行插件的那些插入import语句等，就是插件的generator文件
        await this.applyPlugins(resolvedPlugins);
        // 7.2 开始调用插件的转换脚本 this.files(上面初始化出来的对象) 这里就主要是执行插件的转换脚本来改写入口文件了
        await this.renderFiles();
        // 8 删除插件依赖，因为插件依赖只有在生成项目的时候需要，项目本身是不需要的
        // 8.1 从package.json的开发依赖中删掉插件
        pluginDeps.forEach((dep) => delete pkg.devDependencies[dep]);
        // 8.2 直接覆盖旧的package.json
        this.files['package.json'] = JSON.stringify(pkg, null, 2);
        // 9 把files写入项目目录
        await writeFileTree(this.dir, this.files);
        // 10 安装所有依赖
        await execa('npm', ['install'], orderConfig);
    }
};

export default Creator;