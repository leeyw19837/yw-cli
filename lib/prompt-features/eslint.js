const eslintPrompt = (cli) => {
  // 注入特性
  cli.injectFeature({
    name: 'eslint',
    value: 'eslint',
    description: '是否支持eslint',
  });

  // 选完路由模式后的回调
  cli.onPromptComplete((answers, projectOptions) => {
    if (answers.features.includes('eslint')) {
      if (!projectOptions.plugins) {
        projectOptions.plugins = {};
      }
      projectOptions.plugins['@rippiorg/react-eslint-plugin'] = {};
    }
  })
};

export default eslintPrompt;
