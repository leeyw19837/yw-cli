import ora from 'ora';
import path from 'path';
import Module from 'module';
import fs from 'fs-extra';
import userhome from 'userhome';

// 拼接配置文件的路径
export const configurationsPath =  userhome('.cli.json');

export const getConfigurations = () => {
  // 配置一些默认项
  let config = { configPath: configurationsPath };
  // 判断是否有这个配置文件
  const isExist = fs.existsSync(configurationsPath);
  if (isExist) {
    config = fs.readJSONSync(configurationsPath);
  }
  return config;
};

export const injectImports = (fileInfo, api, { imports }) => {
  const jscodeshift = api.jscodeshift;
  const astRoot = jscodeshift(fileInfo.source);
  const declarations = astRoot.find(jscodeshift.ImportDeclaration);
  // 存放这语法中所有的import语句
  const toImportAstNode = (imp) => jscodeshift(`${imp}\n`).nodes()[0].program.body[0];
  const importAstNodes = imports.map(toImportAstNode);
  // import 只能放在最顶端，所以如果当前有import语句就紧随这些import语句，无就放在首行
  if (declarations.length > 0) {
    declarations.at(-1).insertAfter(importAstNodes);
  } else {
    astRoot.get().node.program.body.unshift(...importAstNodes);
  }
  return astRoot.toSource();
}

export const loadModule = (request, contextDir) => {
  return Module.createRequire(path.resolve(contextDir, 'package.json'))(request);
}

export const writeFileTree = (projectDir, files) => {
  Object.keys(files).forEach((file) => {
    const content = files[file];
    if (file.endsWith('.ejs')) file = file.slice(0, -4);
    const filePath = path.join(projectDir, file);
    fs.ensureDirSync(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
  })
}

export const mergeDeps = (sourceDeps, depsToInject) => {
  const result = Object.assign({}, sourceDeps);
  for (const key in depsToInject) {
    result[key] = depsToInject[key];
  }
  return result
}

export const isObject = (val) => typeof val === 'object';

export const isString = (val) => typeof val === 'string';

// 提取当前代码执行的目录
export const extractCallDir = () => {
  const obj = {};
  Error.captureStackTrace(obj);
  const callSite = obj.stack.split('\n')[3];
  const namedStackRegExp = /\s\((.*):\d+:\d+\)$/;
  let matchResult = callSite.match(namedStackRegExp);
  const fileName = matchResult[1];
  return path.dirname(fileName);
}

export const loading = async (fn, msg, ...args) => {
  // 计数器，失败自动重试最大次数为3，超过3次就直接返回失败
  let counter = 0;
  const run = async () => {
    const spinner = ora(msg);
    spinner.start();
    try {
      const result = await fn(...args);
      spinner.succeed();
      return result;
    } catch (error) {
      spinner.fail('something go wrong, refetching...');
      if (++counter < 3) {
        return run();
      } else {
        return Promise.reject();
      }
    }
  };
  return run();
};