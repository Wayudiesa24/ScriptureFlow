export const STUDY_PROMPTS = [
  {label:'Explain simply',question:'Explain this passage clearly in everyday language.'},
  {label:'Historical context',question:'What is the historical and literary context of this passage? Distinguish evidence from conjecture.'},
  {label:'Key themes',question:'Identify the key themes and central message in this passage.'},
  {label:'Cross-references',question:'Identify relevant biblical cross-references and explain the connections. Do not invent verse quotations.'},
  {label:'Reflect & apply',question:'Suggest thoughtful reflection questions and practical applications while avoiding claims of certainty about my personal life.'},
];
export async function requestStudy({apiKey,passage,question,signal}) {
  if(!apiKey?.trim()) throw new Error('Enter a Gemini API key in Settings for optional AI study.');
  if(!passage?.trim()) throw new Error('Choose a passage first.');
  const text = `You are an academically careful Bible study assistant. Address differences in Christian interpretation respectfully. If interpretations vary, say so. Do not claim private revelation, do not invent historical facts or verse quotes. Distinguish close reading, interpretation and personal application. The translation below is World English Bible.\n\nPASSAGE:\n${passage.slice(0,14000)}\n\nQUESTION:\n${question}`;
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,{
    method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey.trim()},
    body:JSON.stringify({contents:[{parts:[{text}]}],generationConfig:{temperature:0.45,maxOutputTokens:1400}}),signal
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error?.message || `AI request failed (${response.status})`);
  const output=data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('\n').trim();
  if(!output) throw new Error('AI did not return any text.');
  return output;
}
