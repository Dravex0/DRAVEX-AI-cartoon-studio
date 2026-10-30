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
  }
]);
