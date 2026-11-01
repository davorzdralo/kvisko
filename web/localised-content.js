// The game and shuffled choices keep their stable IDs across language changes.
export function answerText(catalogue, quizID, id, fallback) {
  if (catalogue?.locale === 'sr-Cyrl') return fallback;
  return catalogue?.messages[`answer.${quizID}.${id}`] ?? fallback;
}
export function localiseQuestion(catalogue, quizID, question) {
  if (!catalogue || catalogue.locale === 'sr-Cyrl') return question;
  return {
    ...question,
    prompt: catalogue.messages[`quiz.${quizID}.prompt`] ?? question.prompt,
    options: question.options.map((option) => ({ ...option, label: answerText(catalogue, quizID, option.id, option.label) })),
  };
}
