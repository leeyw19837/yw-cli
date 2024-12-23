import axios from 'axios';

axios.interceptors.response.use((res) => {
  return res.data;
});

// 这里是获取模板仓库的所有分支，url写自己的模板仓库url
export const fetchRepoList = () => {
  return axios.get('https://api.github.com/repos/rippi-cli-template/react/branches');
  // return axios.get('https://api.gitee.com/leeyw198371/vue3_scaffold/branches');
};