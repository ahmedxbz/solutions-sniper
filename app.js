const API_URL = 'https://solutions-sniper.onrender.com/api/solve';
let currentLang = 'ar';

const TRANSLATIONS = {
    ar: {
        'app-title': '🎯 قناص الواجبات',
        'app-subtitle': 'استخراج الحلول من دروس اليوتيوب العراقية',
        'label-grade': 'المرحلة الدراسية',
        'label-subject': 'المادة',
        'label-page': 'رقم الصفحة',
        'btn-solve': 'اكتشاف واستخراج الحل 🔍',
        'status-init': 'جاري تشغيل محرك القناص...',
        'status-search': 'جاري البحث في قاعدة بيانات المناهج...',
        'result-title': 'النتيجة المستخرجة:',
        'btn-copy': 'نسخ',
        'btn-copied': 'تم النسخ!',
        'link-source': 'مشاهدة المقطع الأصلي',
        'history-title': 'آخر العمليات',
        'error-page': 'يرجى تحديد رقم الصفحة',
        'lang-btn': 'English'
    },
    en: {
        'app-title': '🎯 Homework Sniper',
        'app-subtitle': 'Extracting solutions from Iraqi YouTube lessons',
        'label-grade': 'Grade Level',
        'label-subject': 'Subject',
        'label-page': 'Page Number',
        'btn-solve': 'Discover & Snipe Answers 🔍',
        'status-init': 'Initializing Sniper Engine...',
        'status-search': 'Searching Curriculum Database...',
        'result-title': 'Extracted Result:',
        'btn-copy': 'Copy',
        'btn-copied': 'Copied!',
        'link-source': 'Watch Original Segment',
        'history-title': 'Recent Extractions',
        'error-page': 'Please specify the page number',
        'lang-btn': 'العربية'
    }
};

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.body.className = currentLang;
    updateUI();
}

function updateUI() {
    const t = TRANSLATIONS[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) el.innerText = t[key];
    });
    document.getElementById('lang-btn').innerText = t['lang-btn'];
    renderHistory();
}

async function fetchAnswer(payload) {
    const loadingElem = document.getElementById('loading');
    const resultElem = document.getElementById('result-container');
    const statusText = document.getElementById('execution-status');
    const t = TRANSLATIONS[currentLang];
    
    loadingElem.classList.remove('hidden');
    resultElem.classList.add('hidden');
    statusText.innerText = t['status-search'];
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        showResult(data.answer, data.sourceUrl);
        saveToHistory(payload.page ? `${payload.subject} P${payload.page}` : 'Extraction', data.answer);
    } catch (err) {
        alert('Sniper Error: ' + err.message);
    } finally {
        loadingElem.classList.add('hidden');
    }
}

function solveSearch() {
    const grade = document.getElementById('grade-select').value;
    const subject = document.getElementById('subject-select').value;
    const page = document.getElementById('page-number').value;
    const t = TRANSLATIONS[currentLang];
    
    if (!page) return alert(t['error-page']);
    fetchAnswer({ grade, subject, page });
}

function showResult(answer, url) {
    const rc = document.getElementById('result-container');
    document.getElementById('answer-box').innerText = answer;
    document.getElementById('source-link').href = url;
    rc.classList.remove('hidden');
}

async function copyResult() {
    const text = document.getElementById('answer-box').innerText;
    const btn = document.querySelector('.copy-btn');
    const t = TRANSLATIONS[currentLang];
    await navigator.clipboard.writeText(text);
    btn.innerText = t['btn-copied'];
    setTimeout(() => btn.innerText = t['btn-copy'], 2000);
}

function saveToHistory(title, answer) {
    let history = JSON.parse(localStorage.getItem('sniper_history') || '[]');
    history.unshift({ title, answer, date: new Date().toLocaleString() });
    if (history.length > 20) history.pop();
    localStorage.setItem('sniper_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    let history = JSON.parse(localStorage.getItem('sniper_history') || '[]');
    history = history.filter(h => !h.title.includes('${') && h.answer !== 'undefined');
    list.innerHTML = history.map(h => `<li><strong>${h.title}</strong><br><small style="color:#888">${h.date}</small><br><div style="margin-top:8px">${h.answer.substring(0, 80)}...</div></li>`).join('');
}

updateUI();
