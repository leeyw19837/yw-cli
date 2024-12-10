#! /usr/bin/env node

// 1 配置可执行的命令 commander
import { Command } from 'commander';
import { fileURLToPath } from "url";
import path, { dirname } from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';

const program = new Command();

program
  .command('create <app-name>')  // 创建命令
  .description('create a new project') // 命令描述
  .option('-f, --force', 'overwrite target directory if it is existed') // 命令选项(选项名，描述) 这里就是解决下重名的情况
  .action((name, options, cmd) => {
    import('../lib/create.js').then(({ default: create }) => {
      create(name, options, cmd);
    });
  });

program
  .command('config [key] [value]')
  .description('check or set configuration item')
  .action((name, option) => {
    import('../lib/config.js').then(({ default: config }) => {
      config(name, option);
    });
  });

program
  .command('plugin [action] [plugin]')
  .description('check or add or delete or clear plugins')
  .action((action, plugin) => {
    import('../lib/plugin.js').then(({ default: config }) => {
      config(action, plugin);
    });
  });

program.on('--help', () => {
  console.log();
  console.log(`Run ${chalk.cyan('yw <command> --help')} to show detail of this command`);
  console.log();
});

const config = fs.readJSONSync(path.resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'));

program
  // 说明版本
  .version(`yw-cli@${config.version}`)
  // 说明使用方式
  .usage('<command [option]');

// 解析用户执行命令传入的参数
program.parse(process.argv);
