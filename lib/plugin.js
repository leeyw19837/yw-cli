import fs from 'fs-extra';
import { getConfigurations, configurationsPath } from './utils.js';

async function config(action, plugin) {
  const configurations = getConfigurations();
  let curPlugins = configurations.plugins ?? [];
  // 如果不是这三种行为则直接返回
  if (!['check', 'add', 'delete', 'clear'].includes(action)) {
    console.log('please enter the correct operation: check/add/delete/clear');
    return;
  }
  // 查看外部插件
  if (action === 'check') {
    console.log(curPlugins);
    return;
  // 增加外部插件
  } else if (action === 'add') {
    if (!plugin) {
      console.log('please enter the plugin name');
      return;
    }
    curPlugins.push(plugin);
  // 删除外部插件
  } else if (action === 'delete') {
    if (!plugin) {
      console.log('please enter the plugin name');
      return;
    }
    curPlugins = curPlugins.filter(item => item !== plugin);
  // 清空外部插件
  } else {
    curPlugins = [];
  }
  configurations.plugins = curPlugins;
  await fs.writeJSON(configurationsPath, configurations, { spaces: 2 });
  console.log('操作成功');
};

export default config;
