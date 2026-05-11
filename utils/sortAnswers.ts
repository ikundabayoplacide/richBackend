// Utility function to sort answers by question number
export function sortAnswersByQuestionNumber(data: any): any {
  if (!data) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sortAnswersByQuestionNumber(item));
  }
  
  const result = { ...data };
  
  if (result.answers && Array.isArray(result.answers)) {
    result.answers.sort((a: any, b: any) => {
      const qNumA = a.question?.questionNumber ?? 999999;
      const qNumB = b.question?.questionNumber ?? 999999;
      return qNumA - qNumB;
    });
  }
  
  if (result.responses && Array.isArray(result.responses)) {
    result.responses = result.responses.map((response: any) => {
      if (response.answers && Array.isArray(response.answers)) {
        response.answers.sort((a: any, b: any) => {
          const qNumA = a.question?.questionNumber ?? 999999;
          const qNumB = b.question?.questionNumber ?? 999999;
          return qNumA - qNumB;
        });
      }
      return response;
    });
  }
  
  return result;
}
