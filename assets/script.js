// Lifted Fitness - client-side quiz + data loader (updated to aggregate per-cert question files)
const state = {questions: [], exercises: []}

async function loadData(){
  // Load questions by reading the batches log which lists generated question files
  try{
    const logRes = await fetch('/questions/batches_log.json');
    if(logRes.ok){
      const log = await logRes.json();
      const files = (log.generated_batches||[]).map(b=>b.file).filter(Boolean);
      const fetches = files.map(f => fetch('/' + f).then(r=> r.ok ? r.json() : null).catch(()=>null));
      const results = await Promise.all(fetches);
      // flatten
      state.questions = results.filter(Boolean).flat();
    }
  }catch(e){
    console.warn('Could not load batches_log.json:', e);
  }

  // Fallback: try loading a combined questions file
  if(!state.questions || state.questions.length===0){
    try{
      const allRes = await fetch('/questions/all_questions.json');
      if(allRes.ok) state.questions = await allRes.json();
    }catch(e){
      console.warn('No combined questions file found:', e);
    }
  }

  // Load exercises
  try{
    const eRes = await fetch('/exercises/exercises.json');
    if(eRes.ok) state.exercises = await eRes.json();
  }catch(e){
    console.warn('Could not load exercises:', e);
  }

  populateCerts();
  populateExercises(state.exercises);
}

function populateCerts(){
  const sel = document.getElementById('cert-select');
  sel.innerHTML = '';
  const certs = [...new Set(state.questions.flatMap(q=>q.certs || ['General']))];
  // Ensure 'General' appears last
  certs.sort((a,b)=>{ if(a==='General') return 1; if(b==='General') return -1; return a.localeCompare(b)});
  certs.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o)})
}

function populateExercises(list){
  const ul = document.getElementById('exercise-list');
  ul.innerHTML = '';
  if(!list) return;
  list.slice(0,50).forEach(ex=>{
    const li = document.createElement('li');
    li.innerHTML = `<strong>${ex.name}</strong> — ${ex.primary_muscle} <div class="muted">${ex.cues||''}</div>`;
    ul.appendChild(li);
  })
}

function startQuiz(){
  const cert = document.getElementById('cert-select').value;
  const num = parseInt(document.getElementById('num-q').value,10)||10;
  const pool = state.questions.filter(q=> (q.certs || []).includes(cert) || (q.certs || []).includes('General'));
  if(pool.length===0){alert('No questions found for that certification yet.');return}
  // random sample
  const shuffled = pool.sort(()=>0.5-Math.random()).slice(0,num);
  state.currentQuiz = {questions:shuffled, index:0, answers: Array(shuffled.length).fill(null)};
  renderQuestion();
  document.getElementById('quiz-area').classList.remove('hidden');
  document.getElementById('results').classList.add('hidden');
}

function renderQuestion(){
  const wrap = document.getElementById('question-wrap');
  const quiz = state.currentQuiz;
  if(!quiz) return;
  const q = quiz.questions[quiz.index];
  wrap.innerHTML = '';
  const div = document.createElement('div'); div.className='question';
  div.innerHTML = `<div><strong>Q${quiz.index+1} of ${quiz.questions.length}</strong></div><div style="margin-top:8px">${q.stem}</div>`;
  const opts = document.createElement('div'); opts.className='options';
  q.options.forEach((opt,oi)=>{
    const o = document.createElement('div'); o.className='option'; o.tabIndex=0; o.textContent = opt.text;
    if(quiz.answers[quiz.index]===oi) o.classList.add('selected');
    o.onclick = ()=>{quiz.answers[quiz.index]=oi; renderQuestion()};
    opts.appendChild(o);
  });
  wrap.appendChild(div); wrap.appendChild(opts);
}

function prevQuestion(){ if(!state.currentQuiz) return; if(state.currentQuiz.index>0){state.currentQuiz.index--; renderQuestion()} }
function nextQuestion(){ if(!state.currentQuiz) return; if(state.currentQuiz.index < state.currentQuiz.questions.length-1){state.currentQuiz.index++; renderQuestion()} }

function finishQuiz(){
  const quiz = state.currentQuiz; if(!quiz) return;
  let correct=0; const details=[];
  quiz.questions.forEach((q,i)=>{
    const ans = quiz.answers[i];
    const isCorrect = ans!=null && q.options[ans] && q.options[ans].isCorrect;
    if(isCorrect) correct++;
    details.push({q,qIndex:i,selected:ans,isCorrect});
  });
  const percent = Math.round(100*correct/quiz.questions.length);
  const res = document.getElementById('results'); res.classList.remove('hidden');
  res.innerHTML = `<h4>Score: ${correct} / ${quiz.questions.length} (${percent}%)</h4>`;
  details.forEach(d=>{
    const wrap = document.createElement('div'); wrap.className='card';
    const selText = d.selected==null ? '<em>Not answered</em>' : d.q.options[d.selected].text;
    wrap.innerHTML = `<div><strong>${d.q.stem}</strong></div><div>Selected: ${selText}</div><div>Answer: ${d.q.options.find(o=>o.isCorrect).text}</div><div class="muted">${d.q.explanation||''}</div>`;
    res.appendChild(wrap);
  });
}

// exercise search
function bindExerciseSearch(){
  const input = document.getElementById('exercise-search');
  input.addEventListener('input', ()=>{
    const q = input.value.toLowerCase();
    const filtered = state.exercises.filter(e=> (e.name+" "+(e.primary_muscle||"")+" "+(e.cues||"")).toLowerCase().includes(q));
    populateExercises(filtered);
  });
}

// events
window.addEventListener('DOMContentLoaded', ()=>{
  loadData().then(()=>{
    document.getElementById('start-quiz').addEventListener('click', startQuiz);
    document.getElementById('prev-btn').addEventListener('click', prevQuestion);
    document.getElementById('next-btn').addEventListener('click', nextQuestion);
    document.getElementById('finish-btn').addEventListener('click', finishQuiz);
    bindExerciseSearch();
  });
});
