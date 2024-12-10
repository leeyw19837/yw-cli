import fs from 'fs-extra';
import { getConfigurations, configurationsPath } from './utils.js';

async function config(key, value) {
  const configurations = getConfigurations();
  if (key && value) {
    // 校验是否改的是配置文件的路径，此配置不可更改
    if (key === 'configPath') {
      console.log('配置文件路径不可更改');
      return;
    }
    // key和value都存在，说明是写配置
    configurations[key] = value;
    await fs.writeJSON(configurationsPath, configurations, { spaces: 2 });
    console.log(`${key}=${value} 配置已保存`);
  } else if (key) {
    // 没有value说明是查值
    const result = configurations[key];
    console.log(result);
  } else {
    // 都没有就说明是查看所有的配置
    console.log(configurations);
  }
};

export default config;
