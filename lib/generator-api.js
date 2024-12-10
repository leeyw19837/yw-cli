import path from 'path';
import { glob } from 'glob';
import { extractCallDir, mergeDeps, isObject, isString } from './utils.js';
import { render } from 'ejs';
import fs from 'fs-extra';
import { isBinaryFile } from 'isbinaryfile';
import vueCodeMod from 'vue-codemod';
const { runTransformation } = vueCodeMod;

class GeneratorApi {
  constructor(id, creator, options) {
    this.id = id;
    this.creator = creator;
    this.options = options;
  }
  get entryFile() {
    return 'src/index.jsx';
  }
  async _injectFileMiddleWare(middleWare) {
    this.creator.fileMiddleWares.push(middleWare);
  }
  // 把模板进行渲染并输出到项目中
  render(templateDir) {
    const execDir = extractCallDir();
    if (isString(templateDir)) {
      templateDir = path.resolve(execDir, templateDir);
      this._injectFileMiddleWare(async (files, projectOptions) => {
        // 拿到该文件夹下的所有文件
        const templateInnerFiles = await glob('**/*', { cwd: templateDir, nodir: true });
        const templateOutsideFiles = await glob('.*', { cwd: templateDir, nodir: true });
        const templateFiles = [...templateOutsideFiles, ...templateInnerFiles]
        for (let i = 0; i < templateFiles.length; i++) {
          let templateFile = templateFiles[i];
          // 给creator的files赋值
          files[templateFile] = await renderFile(path.resolve(templateDir, templateFile), projectOptions);
        }
      })
    }
  }
  // 添加依赖包
  extendPackage(toMerge) {
    const pkg = this.creator.pkg;
    for (const key in toMerge) {
      const value = toMerge[key];
      const exist = pkg[key];
      if (isObject(value) && (key === 'dependencies' || key === 'devDependencies')) {
        pkg[key] = mergeDeps(exist || {}, value);
      } else {
        pkg[key] = value;
      }
    }
  }
  // 插入import
  injectImport(file, newImport) {
    const imports = (this.creator.imports[file] = this.creator.imports[file] || []);
    imports.push(newImport);
  }
  // 转换脚本
  transformScript(file, codemod, options = {}) {
    this._injectFileMiddleWare((files) => {
      files[file] = runTransformation(
        { path: file, source: files[file] },
        codemod,
        options,
      );
    })
  }
}

async function renderFile(templatePath, projectOptions) {
  // 如果是二进制文件的话直接返回buffer
  if (await isBinaryFile(templatePath)) {
    return await fs.rendFileSync(templatePath);
  }
  const template = await fs.readFileSync(templatePath, 'utf8');
  return render(template, projectOptions);
}

export default GeneratorApi;
