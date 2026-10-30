/** Small, versioned starter curriculum for repeatable DRAVEX AI evaluation. */
export const AI_CURRICULUM_V1 = Object.freeze([
  {
    id: 'ru-fox-key-01',
    language: 'ru',
    character: 'Лисёнок',
    story: 'Лисёнок находит серебряный ключ. В лесу гаснут огни. Сова показывает скрытую тропу.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Лисёнок находит серебряный ключ.',
      'В лесу гаснут огни.',
      'Сова показывает скрытую тропу.'
    ],
    skills: ['story-structure', 'source-fidelity', 'action-planning', 'camera-language']
  },
  {
    id: 'en-dragon-home-01',
    language: 'en',
    character: 'Pip',
    story: 'A young dragon discovers a map. A storm blocks the mountain pass. A glowing bird guides Pip home.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'A young dragon discovers a map.',
      'A storm blocks the mountain pass.',
      'A glowing bird guides Pip home.'
    ],
    skills: ['story-structure', 'source-fidelity', 'action-planning', 'camera-language']
  },
  {
    id: 'uk-robot-garden-01',
    language: 'uk',
    character: 'Робот Мико',
    story: 'Робот Мико знаходить сухе насіння. Він лагодить старий поливальний механізм. У саду з’являються перші квіти.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Робот Мико знаходить сухе насіння.',
      'Він лагодить старий поливальний механізм.',
      'У саду з’являються перші квіти.'
    ],
    skills: ['story-structure', 'source-fidelity', 'action-planning', 'camera-language']
  },
  {
    id: 'ru-owl-escape-02',
    language: 'ru',
    character: 'Сова',
    story: 'Сова слышит треск в тёмном лесу. Волк преграждает ей дорогу. Сова замечает свет в пещере и убегает к нему.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Сова слышит треск в тёмном лесу.',
      'Волк преграждает ей дорогу.',
      'Сова замечает свет в пещере и убегает к нему.'
    ],
    skills: ['story-structure', 'source-fidelity', 'source-order', 'action-planning', 'camera-language']
  },
  {
    id: 'en-robot-repair-02',
    language: 'en',
    character: 'Miko',
    story: 'Miko finds a broken water pump. A storm approaches the garden. Miko repairs the pump and the flowers receive water again.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Miko finds a broken water pump.',
      'A storm approaches the garden.',
      'Miko repairs the pump and the flowers receive water again.'
    ],
    skills: ['story-structure', 'source-fidelity', 'source-order', 'action-planning', 'camera-language']
  },
  {
    id: 'uk-bird-guidance-02',
    language: 'uk',
    character: 'Мико',
    story: 'Мико губиться серед високих дерев. Маленький птах показує йому стежку. Мико знаходить свій будинок і радіє поверненню.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Мико губиться серед високих дерев.',
      'Маленький птах показує йому стежку.',
      'Мико знаходить свій будинок і радіє поверненню.'
    ],
    skills: ['story-structure', 'source-fidelity', 'source-order', 'action-planning', 'camera-language']
  },
  {
    id: 'es-fox-transformation-02',
    language: 'es',
    character: 'Luna',
    story: 'Luna encuentra una semilla brillante. La planta junto al río. La semilla crece y se transforma en un árbol luminoso.',
    expectedSceneCount: 5,
    expectedStoryDetails: [
      'Luna encuentra una semilla brillante.',
      'La planta junto al río.',
      'La semilla crece y se transforma en un árbol luminoso.'
    ],
    skills: ['story-structure', 'source-fidelity', 'source-order', 'action-planning', 'camera-language']
  }

]);
