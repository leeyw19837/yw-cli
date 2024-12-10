function getPromptFeatures() {
  return ['router', 'eslint'].map((file) => import(`./prompt-features/${file}.js`));
};

export default getPromptFeatures;
