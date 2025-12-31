
import React, { useState, useEffect, useRef } from 'react';
import { Brain, Settings, ArrowLeft, Send, Shield, Globe, Plus, Check, User, Camera, Book, Trash2, Loader2, Image as ImageIcon, WifiOff, Mic, Square, Bell, X, Timer, Play, Pause, Coffee, Moon, Sun, FileText, Printer, Download, Users, Lock, Crown, ShoppingBag, Gamepad2, FlaskConical, Calculator, RefreshCw, Star, XCircle, CheckCircle2, MessageSquare, PencilLine, CheckSquare, Monitor, UserRound, Volume2, Sliders, TrendingUp, Heart, Lightbulb, Target, Award, Zap, MessageCircle, HelpCircle, BarChart3, PieChart, Activity } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Language, UserRole, UserProfile, Subject, ChatMessage, VoicePreference, LearningPace, SavedLesson, StudyTimePreference, Difficulty, PremiumContentResponse, ExerciseType } from './types';
import { UI_TEXT, SUBJECTS, AVATARS } from './constants';
import { generateTutorResponse, explainLessonImage, generateChildReport, generateFamilyReport, generatePremiumContent, generateLessonQuiz, generateObjectImage } from './services/geminiService';
import { speechService } from './services/speechService';
import { Button } from './components/Button';
import { ChatBubble } from './components/ChatBubble';

const INITIAL_PROFILES: UserProfile[] = [
  { id: '1', name: 'أحمد', role: UserRole.KID, age: 10, gradeLevel: 'Grade 5', avatar: '🦁', preferredVoice: 'male', learningPace: 'normal', studyTimePreference: 'afternoon' },
  { id: '2', name: 'سارة', role: UserRole.KID, age: 12, gradeLevel: 'Grade 7', avatar: '🦄', preferredVoice: 'female', learningPace: 'fast', studyTimePreference: 'evening' },
];

type ViewState = 'onboarding' | 'parent-dashboard' | 'kid-select' | 'add-child' | 'subject-select' | 'chat' | 'smart-lesson-upload' | 'library' | 'lesson-view' | 'report-view' | 'premium-dashboard' | 'premium-content';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ActivityBarChart = () => (
  <div className="flex flex-col h-full">
    <div className="flex items-center justify-between mb-6">
      <h4 className="font-bold text-slate-700 dark:text-stone-300 flex items-center gap-2"><Activity size={18} className="text-indigo-500" /> نشاط التعلم الأسبوعي</h4>
      <div className="flex gap-2 text-[10px] font-bold text-slate-400">
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-500 rounded-full"></div> دروس</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 bg-indigo-200 dark:bg-stone-700 rounded-full"></div> اختبارات</span>
      </div>
    </div>
    <div className="flex-1 flex items-end gap-2 min-h-[150px]">
      {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full bg-slate-100 dark:bg-stone-800 rounded-t-lg relative overflow-hidden" style={{ height: '100px' }}>
            <div className="absolute bottom-0 w-full bg-indigo-200 dark:bg-stone-700 rounded-t-lg transition-all" style={{ height: `${h * 0.7}%` }}></div>
            <div className="absolute bottom-0 w-full bg-indigo-500 rounded-t-lg transition-all" style={{ height: `${h}%` }}></div>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">{['S','M','T','W','T','F','S'][i]}</span>
        </div>
      ))}
    </div>
  </div>
);

const ProgressCircle = ({ percentage, color, label }: { percentage: number, color: string, label: string }) => {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative flex items-center justify-center">
        <svg className="w-32 h-32 transform -rotate-90">
          <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-stone-800" />
          <circle cx="64" cy="64" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className={`${color} transition-all duration-1000`} />
        </svg>
        <span className="absolute text-2xl font-black dark:text-white">{percentage}%</span>
      </div>
      <span className="font-bold text-slate-500 dark:text-stone-400">{label}</span>
    </div>
  );
};

export default function App() {
  const [language, setLanguage] = useState<Language>(Language.ARABIC);
  const [currentView, setCurrentView] = useState<ViewState>('onboarding');
  const [profiles, setProfiles] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('smart_tutor_profiles');
    return saved ? JSON.parse(saved) : INITIAL_PROFILES;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isNightMode, setIsNightMode] = useState(() => localStorage.getItem('smart_tutor_night_mode') === 'true');
  const [currentProfile, setCurrentProfile] = useState<UserProfile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [isPinError, setIsPinError] = useState(false);
  const [savedLessons, setSavedLessons] = useState<SavedLesson[]>([]);
  const [lessonUploadData, setLessonUploadData] = useState({ bookTitle: '', pageNumber: '', image: '' });
  const [currentLesson, setCurrentLesson] = useState<SavedLesson | null>(null);
  const [reportData, setReportData] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isFamilyReport, setIsFamilyReport] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // New Child Profile Form State
  const [newChildData, setNewChildData] = useState({
    name: '',
    age: 10,
    gradeLevel: 'Grade 5',
    avatar: '🦁'
  });

  // Premium State
  const [premiumType, setPremiumType] = useState<'game' | 'math' | 'science' | 'language' | 'guess' | null>(null);
  const [premiumChallenge, setPremiumChallenge] = useState<PremiumContentResponse | null>(null);
  const [isPremiumLoading, setIsPremiumLoading] = useState(false);
  const [showLangSelector, setShowLangSelector] = useState(false);
  const [selectedLanguageForChallenge, setSelectedLanguageForChallenge] = useState<'english' | 'french' | null>(null);
  const [premiumChallengeImage, setPremiumChallengeImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [quizData, setQuizData] = useState<PremiumContentResponse | null>(null);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<'idle' | 'correct' | 'incorrect'>('idle');
  const [showLessonCompleteModal, setShowLessonCompleteModal] = useState(false);
  const [speakingRate, setSpeakingRate] = useState(0.9);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [showTimerConfig, setShowTimerConfig] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === Language.ARABIC ? 'rtl' : 'ltr';
    document.body.className = language === Language.ARABIC ? 'font-ar' : 'font-en';
  }, [language]);

  useEffect(() => localStorage.setItem('smart_tutor_night_mode', isNightMode.toString()), [isNightMode]);
  useEffect(() => localStorage.setItem('smart_tutor_profiles', JSON.stringify(profiles)), [profiles]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('smart_tutor_lessons');
    if (saved) try { setSavedLessons(JSON.parse(saved)); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (showConfetti) {
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConfetti]);

  useEffect(() => {
    if (timerStatus === 'running' && timeLeft > 0) {
      timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && timerStatus === 'running') {
      clearInterval(timerRef.current);
      setTimerStatus('idle');
      alert(UI_TEXT[language].breakTime);
    }
    return () => clearInterval(timerRef.current);
  }, [timerStatus, timeLeft, language]);

  const t = UI_TEXT[language];

  const handlePrint = () => window.print();
  const handleDownload = () => {
    const reportTitle = isFamilyReport ? "Family Report" : `${currentProfile?.name} Progress Report`;
    const blob = new Blob([reportTitle + "\n\n" + reportData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/\s/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) { videoRef.current.srcObject = stream; setIsCameraActive(true); }
    } catch (err) { console.error(err); alert("Could not access camera."); }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) { (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop()); videoRef.current.srcObject = null; }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setLessonUploadData({ ...lessonUploadData, image: canvas.toDataURL('image/jpeg') });
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLessonUploadData({ ...lessonUploadData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (customMessage?: string) => {
    const textToSend = customMessage || inputText;
    if (!isOnline) { alert(t.offlineError); return; }
    if (!textToSend.trim() || isLoading || !currentProfile) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    try {
      const responseText = await generateTutorResponse(userMsg.text, messages.slice(-10), language, selectedSubject, currentProfile);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: Date.now() }]);
    } catch (error) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t.errorGeneric, timestamp: Date.now(), isError: true }]);
    } finally { setIsLoading(false); }
  };

  const toggleListening = () => {
    if (isListening) { speechService.stopListening(); setIsListening(false); }
    else { setIsListening(true); speechService.listen(language, (text) => setInputText(text), () => setIsListening(false)); }
  };

  const handleConfirmation = async (understood: boolean) => {
    if (understood) {
      speechService.speak(language === Language.ARABIC ? "ممتاز ننتقل للسؤال التالي" : "Excellent!", language, currentProfile?.preferredVoice, speakingRate);
      handleSendMessage(language === Language.ARABIC ? "نعم فهمت، ننتقل الآن إلى السؤال التالي." : "Yes understood!");
    } else {
      speechService.speak(language === Language.ARABIC ? "لا بأس سأشرح بطريقة أبسط" : "No problem!", language, currentProfile?.preferredVoice, speakingRate);
      setTimeout(() => {
        handleSendMessage(language === Language.ARABIC ? "لا لم أفهم، هل يمكنك إعادة الشرح بطريقة أبسط جداً؟" : "I didn't understand, explain more simply please.");
      }, 1500);
    }
  };

  const handleAnalyzeLesson = async () => {
    if (!isOnline || !lessonUploadData.image || !currentProfile) return;
    setIsLoading(true);
    try {
      const result = await explainLessonImage(lessonUploadData.image.split(',')[1], lessonUploadData.bookTitle || 'Lesson', language, currentProfile);
      const newLesson: SavedLesson = { id: Date.now().toString(), title: lessonUploadData.bookTitle || (language === Language.ARABIC ? 'درس جديد' : 'New Lesson'), explanation: result.explanation, recognizedText: result.recognizedText, exerciseType: result.exerciseType, resources: result.resources, timestamp: Date.now(), imageData: lessonUploadData.image, isCompleted: false };
      const updated = [newLesson, ...savedLessons];
      setSavedLessons(updated);
      localStorage.setItem('smart_tutor_lessons', JSON.stringify(updated));
      setMessages([{ id: 'init-lesson', role: 'model', text: result.explanation, timestamp: Date.now() }]);
      setCurrentLesson(newLesson); 
      setCurrentView('lesson-view');
      setLessonUploadData({ bookTitle: '', pageNumber: '', image: '' });
    } catch (error) { alert(t.errorGeneric); } finally { setIsLoading(false); }
  };

  const handleAddChild = () => {
    if (!newChildData.name.trim()) { alert(t.fillAll); return; }
    const newProfile: UserProfile = {
      id: Date.now().toString(),
      name: newChildData.name,
      role: UserRole.KID,
      age: newChildData.age,
      gradeLevel: newChildData.gradeLevel,
      avatar: newChildData.avatar,
      preferredVoice: 'female',
      learningPace: 'normal',
      studyTimePreference: 'afternoon'
    };
    setProfiles([...profiles, newProfile]);
    setNewChildData({ name: '', age: 10, gradeLevel: 'Grade 5', avatar: '🦁' });
    setCurrentView('parent-dashboard');
  };

  const startPremiumChallenge = async (type: 'game' | 'math' | 'science' | 'language' | 'guess', specificLang?: 'english' | 'french') => {
    if (!currentProfile) return;
    setPremiumType(type);
    setIsPremiumLoading(true);
    setCurrentView('premium-content');
    setPremiumChallengeImage(null);
    try {
      const content = await generatePremiumContent(type, currentProfile, language, 'medium', specificLang);
      setPremiumChallenge(content);
      
      // If language challenge or guess challenge, generate a small image
      if (content.imagePrompt) {
        const imageUrl = await generateObjectImage(content.imagePrompt);
        setPremiumChallengeImage(imageUrl);
      }
    } catch (e) {
      alert(t.errorGeneric);
      setCurrentView('premium-dashboard');
    } finally {
      setIsPremiumLoading(false);
    }
  };

  const renderCurrentView = () => {
    switch(currentView) {
      case 'onboarding':
        return (
          <div className="min-h-screen bg-gradient-to-b from-indigo-500 to-purple-600 dark:from-stone-900 dark:to-stone-950 flex flex-col items-center justify-center p-6 text-white relative">
            <div className="absolute top-6 start-6 flex gap-3"><button onClick={() => setLanguage(l => l === Language.ARABIC ? Language.ENGLISH : Language.ARABIC)} className="bg-white/20 p-2 rounded-full backdrop-blur-sm transition flex items-center gap-2"><Globe size={20} /> <span className="text-xs font-bold">{t.switchLang}</span></button><NightModeToggle /></div>
            <div className="bg-white p-4 rounded-[2rem] shadow-xl mb-8 animate-bounce dark:bg-stone-800"><Brain size={64} className="text-indigo-600 dark:text-indigo-400" /></div>
            <h1 className="text-4xl font-black mb-12 text-center">{t.tutorName}</h1>
            <div className="w-full max-w-md space-y-4">
              <Button fullWidth size="xl" variant="secondary" onClick={() => setCurrentView('kid-select')} className="group !bg-white/95 dark:!bg-stone-800 !text-indigo-900 font-black"><span className="text-3xl">🧒</span> {t.kidRole}</Button>
              <Button fullWidth size="xl" variant="ghost" onClick={() => setShowPinModal(true)} className="!text-white border-2 border-white/20 font-bold"><span className="text-2xl">🛡️</span> {t.parentRole}</Button>
            </div>
          </div>
        );

      case 'parent-dashboard':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950 p-6">
            <header className="flex items-center justify-between mb-8 max-w-4xl mx-auto"><div className="flex items-center gap-3"><button onClick={() => setCurrentView('onboarding')} className="p-2 bg-white dark:bg-stone-900 rounded-full shadow-sm"><ArrowLeft /></button><h2 className="text-2xl font-black dark:text-stone-100">{t.parentArea}</h2></div><NightModeToggle /></header>
            <main className="max-w-4xl mx-auto grid gap-6">
              <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-3xl font-black mb-2">{t.dashboard}</h3>
                  <p className="opacity-80 mb-6 max-w-sm">{t.premiumDesc}</p>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={async () => { setIsGeneratingReport(true); setIsFamilyReport(true); setCurrentView('report-view'); const rep = await generateFamilyReport(profiles, language); setReportData(rep); setIsGeneratingReport(false); }} disabled={profiles.length === 0}><Users size={20} /> {language === Language.ARABIC ? 'توليد تقرير شامل' : 'Generate Global Report'}</Button>
                  </div>
                </div>
                <Users size={120} className="absolute bottom-[-20px] end-[-20px] opacity-10 rotate-12" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map(p => (
                  <div key={p.id} className="bg-white dark:bg-stone-900 p-6 rounded-[2rem] shadow-sm border dark:border-stone-800 flex flex-col gap-4">
                    <div className="flex items-center gap-4"><div className="text-4xl bg-slate-100 dark:bg-stone-800 p-3 rounded-2xl">{p.avatar}</div><div className="flex-1"><h4 className="text-xl font-bold dark:text-stone-100">{p.name}</h4><p className="text-xs text-slate-500 font-bold uppercase">{p.gradeLevel || t.age + ' ' + p.age}</p></div><button onClick={() => setProfiles(profiles.filter(pr => pr.id !== p.id))} className="p-2 text-red-400 hover:bg-red-50 rounded-full"><Trash2 size={18} /></button></div>
                    <div className="flex gap-2"><Button fullWidth size="sm" variant="secondary" onClick={async () => { setCurrentProfile(p); setIsGeneratingReport(true); setIsFamilyReport(false); setCurrentView('report-view'); const rep = await generateChildReport(p, [], language); setReportData(rep); setIsGeneratingReport(false); }}><TrendingUp size={16} /> {t.progress}</Button><Button fullWidth size="sm" onClick={() => { setCurrentProfile(p); setCurrentView('subject-select'); }}><Play size={16} /> {t.letsGo}</Button></div>
                  </div>
                ))}
                <button onClick={() => setCurrentView('add-child')} className="border-4 border-dashed border-slate-200 dark:border-stone-800 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 transition-all"><Plus size={48} /><span className="font-bold">{t.addChild}</span></button>
              </div>
            </main>
          </div>
        );

      case 'add-child':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950 p-6">
            <header className="flex items-center gap-4 mb-8 max-w-xl mx-auto"><button onClick={() => setCurrentView('parent-dashboard')} className="p-2 bg-white dark:bg-stone-900 rounded-full shadow-sm"><ArrowLeft /></button><h2 className="text-2xl font-black dark:text-stone-100">{t.addChild}</h2></header>
            <main className="max-w-xl mx-auto bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-stone-800 space-y-6">
              <div className="space-y-4">
                <div><label className="block text-sm font-bold text-slate-400 mb-2 uppercase">{t.name}</label><input type="text" value={newChildData.name} onChange={e => setNewChildData({...newChildData, name: e.target.value})} className="w-full p-4 rounded-2xl border-2 dark:bg-stone-800 dark:border-stone-700 outline-none focus:border-indigo-500 font-bold dark:text-white" placeholder="أحمد" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-slate-400 mb-2 uppercase">{t.age}</label><input type="number" value={newChildData.age} onChange={e => setNewChildData({...newChildData, age: parseInt(e.target.value)})} className="w-full p-4 rounded-2xl border-2 dark:bg-stone-800 dark:border-stone-700 outline-none focus:border-indigo-500 font-bold dark:text-white" /></div>
                  <div><label className="block text-sm font-bold text-slate-400 mb-2 uppercase">{t.grade}</label><select value={newChildData.gradeLevel} onChange={e => setNewChildData({...newChildData, gradeLevel: e.target.value})} className="w-full p-4 rounded-2xl border-2 dark:bg-stone-800 dark:border-stone-700 outline-none focus:border-indigo-500 font-bold dark:text-white">
                    {[1,2,3,4,5,6,7,8,9].map(g => <option key={g} value={`Grade ${g}`}>{language === Language.ARABIC ? `الصف ${g}` : `Grade ${g}`}</option>)}
                  </select></div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2 uppercase">{t.selectAvatar}</label>
                  <div className="grid grid-cols-6 gap-2">
                    {AVATARS.map(a => <button key={a} onClick={() => setNewChildData({...newChildData, avatar: a})} className={`text-2xl p-2 rounded-xl border-2 transition-all ${newChildData.avatar === a ? 'border-indigo-500 bg-indigo-50 scale-110' : 'border-transparent bg-slate-50 dark:bg-stone-800'}`}>{a}</button>)}
                  </div>
                </div>
              </div>
              <Button fullWidth size="xl" onClick={handleAddChild} className="mt-4">{t.createProfile}</Button>
            </main>
          </div>
        );

      case 'premium-dashboard':
        return (
          <div className="min-h-screen bg-amber-50 dark:bg-stone-950 p-6">
            <header className="flex items-center gap-4 mb-8 max-w-4xl mx-auto"><button onClick={() => setCurrentView('subject-select')} className="p-2 bg-white dark:bg-stone-900 rounded-full shadow-sm"><ArrowLeft /></button><h2 className="text-2xl font-black dark:text-stone-100 flex items-center gap-2"><Crown className="text-amber-500" /> {t.premiumDashboard}</h2></header>
            <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {[
                { type: 'game', label: t.premiumGames, icon: <Gamepad2 size={40} />, color: 'bg-rose-500' },
                { type: 'math', label: t.premiumMath, icon: <Calculator size={40} />, color: 'bg-blue-500' },
                { type: 'science', label: t.premiumScience, icon: <FlaskConical size={40} />, color: 'bg-emerald-500' },
                { type: 'language', label: t.premiumLang, icon: <MessageSquare size={40} />, color: 'bg-violet-500' },
                { type: 'guess', label: t.premiumGuess, icon: <Target size={40} />, color: 'bg-amber-500' }
              ].map(card => (
                <button key={card.type} onClick={() => { if(card.type === 'language') setShowLangSelector(true); else startPremiumChallenge(card.type as any); }} className="bg-white dark:bg-stone-900 p-8 rounded-[3rem] shadow-xl border-b-8 border-slate-100 dark:border-stone-800 flex flex-col items-center gap-4 transition-all hover:-translate-y-2 group">
                  <div className={`${card.color} text-white p-6 rounded-[2rem] group-hover:scale-110 transition-transform`}>{card.icon}</div>
                  <h3 className="text-2xl font-black dark:text-stone-100">{card.label}</h3>
                  <div className="w-12 h-1.5 bg-slate-100 dark:bg-stone-800 rounded-full"></div>
                </button>
              ))}
            </main>
            {showLangSelector && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[600] flex items-center justify-center p-6">
                 <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border-4 border-amber-100 text-center animate-fade-in-up">
                    <h3 className="text-2xl font-black mb-6 dark:text-white">{t.selectLangTitle}</h3>
                    <div className="grid gap-4">
                       <button onClick={() => { setSelectedLanguageForChallenge('english'); startPremiumChallenge('language', 'english'); setShowLangSelector(false); }} className="p-5 bg-blue-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center gap-3 border-2 border-transparent hover:border-blue-500 transition-all group active:scale-95"><span className="text-3xl">🇬🇧</span> <span className="text-xl font-bold dark:text-stone-100 group-hover:text-blue-600">English</span></button>
                       <button onClick={() => { setSelectedLanguageForChallenge('french'); startPremiumChallenge('language', 'french'); setShowLangSelector(false); }} className="p-5 bg-rose-50 dark:bg-stone-800 rounded-2xl flex items-center justify-center gap-3 border-2 border-transparent hover:border-rose-500 transition-all group active:scale-95"><span className="text-3xl">🇫🇷</span> <span className="text-xl font-bold dark:text-stone-100 group-hover:text-rose-600">Français</span></button>
                    </div>
                    <Button variant="ghost" className="mt-6" onClick={() => setShowLangSelector(false)}>{t.cancel}</Button>
                 </div>
              </div>
            )}
          </div>
        );

      case 'premium-content':
        return (
          <div className="min-h-screen bg-[#896C6C] flex flex-col items-center justify-center p-6 text-white overflow-hidden relative">
            <div className="absolute top-8 left-8"><button onClick={() => setCurrentView('premium-dashboard')} className="p-3 bg-white/20 rounded-full backdrop-blur-md text-white"><ArrowLeft /></button></div>
            <div className="max-w-2xl w-full">
               {isPremiumLoading ? (
                 <div className="flex flex-col items-center gap-8 animate-pulse">
                   <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center"><Loader2 size={64} className="animate-spin text-white" /></div>
                   <h2 className="text-3xl font-black text-center text-white">{t.thinking}</h2>
                 </div>
               ) : premiumChallenge && (
                 <div className="bg-slate-200 text-blue-800 p-10 rounded-[3rem] shadow-2xl space-y-8 animate-fade-in-up flex flex-col items-center border-4 border-slate-300">
                    <div className="w-full flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 text-blue-700 font-black uppercase tracking-widest text-sm"><Crown size={18} className="text-amber-500"/> تحدي {premiumType?.toUpperCase()} المتميز</div>
                      <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black border border-blue-200 uppercase">{premiumChallenge.difficulty}</span>
                    </div>
                    
                    {/* Visual Asset Container */}
                    {premiumChallengeImage && (
                       <div className="flex flex-col items-center gap-4 mb-2">
                          <div className="w-56 h-56 bg-slate-50 rounded-[3rem] border-4 border-slate-300 overflow-hidden shadow-inner flex items-center justify-center bg-white">
                             <img src={premiumChallengeImage} className="w-full h-full object-cover animate-zoom-in" alt="Object" />
                          </div>
                          <p className="text-xl font-black text-blue-600 uppercase tracking-widest drop-shadow-sm italic">? ما هذا</p>
                       </div>
                    )}

                    <h3 className="text-3xl font-black text-center mb-6 leading-tight text-blue-900">{premiumChallenge.question}</h3>
                    
                    {/* Centered Options List - Gray Background with Blue Text as requested */}
                    <div className="grid gap-4 w-full max-w-sm mx-auto">
                      {premiumChallenge.options?.map(o => (
                        <button key={o} onClick={() => {
                          const isC = o === premiumChallenge.answer;
                          if (isC) { setShowConfetti(true); speechService.speak(language === Language.ARABIC ? "أنت رائع حقاً!" : "You are amazing!", language); }
                          alert(isC ? '🎉 إجابة صحيحة!' : premiumChallenge.explanation);
                        }} className="p-6 rounded-[2.2rem] bg-slate-300 text-blue-700 font-black text-2xl text-center shadow-md hover:bg-slate-400 hover:text-blue-900 transition-all border-b-4 border-slate-400 active:translate-y-1 active:border-b-0">
                           {o}
                        </button>
                      ))}
                    </div>
                    
                    <div className="pt-8 w-full border-t-2 border-slate-300 mt-4 flex justify-center">
                      <button onClick={() => startPremiumChallenge(premiumType!, selectedLanguageForChallenge || undefined)} className="flex items-center gap-3 text-blue-600 font-black hover:text-blue-800 transition-colors py-2 px-6 rounded-2xl bg-slate-100 shadow-sm border border-slate-200">
                        <RefreshCw size={24}/> {language === Language.ARABIC ? 'تحدي جديد' : 'New Challenge'}
                      </button>
                    </div>
                 </div>
               )}
            </div>
          </div>
        );

      case 'report-view':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950">
            <header className="p-4 bg-white dark:bg-stone-900 shadow-sm flex items-center gap-4 sticky top-0 z-20"><button onClick={() => setCurrentView('parent-dashboard')} className="p-2 bg-slate-100 dark:bg-stone-800 rounded-full"><ArrowLeft /></button><h2 className="text-xl font-black dark:text-stone-100">{isFamilyReport ? t.dashboard : `تقرير ${currentProfile?.name}`}</h2><div className="ms-auto flex gap-2"><button onClick={handlePrint} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full"><Printer size={20} /></button><button onClick={handleDownload} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full"><Download size={20} /></button></div></header>
            <main className="p-6 max-w-4xl mx-auto w-full pb-20">
              {isGeneratingReport ? <div className="py-20 flex flex-col items-center gap-6 animate-pulse"><Brain size={48} className="text-indigo-500 animate-bounce" /><h3 className="text-2xl font-black dark:text-stone-100">{t.analyzing}</h3></div> : (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-stone-800"><ActivityBarChart /></div>
                    <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] shadow-sm border dark:border-stone-800 flex flex-col items-center justify-center"><ProgressCircle percentage={85} color="text-emerald-500" label={t.completed} /></div>
                  </div>
                  <div className="bg-white dark:bg-stone-900 p-8 rounded-[2.5rem] shadow-md border dark:border-stone-800 prose dark:prose-invert max-w-none"><ReactMarkdown>{reportData}</ReactMarkdown></div>
                </div>
              )}
            </main>
          </div>
        );

      case 'kid-select':
        return (
          <div className="min-h-screen bg-[#F0FDF4] dark:bg-stone-950 flex flex-col p-6 items-center justify-center">
            <h2 className="text-3xl font-bold dark:text-stone-100 mb-8">{t.whoIsLearning}</h2>
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              {profiles.map(p => (
                <button key={p.id} onClick={() => { setCurrentProfile(p); setCurrentView('subject-select'); }} className="bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-md border-b-4 border-slate-200 dark:border-stone-800 flex flex-col items-center gap-2 active:scale-95 transition-all"><span className="text-5xl">{p.avatar}</span><span className="font-bold dark:text-stone-200">{p.name}</span></button>
              ))}
            </div>
            <Button variant="ghost" fullWidth className="mt-8 max-w-md" onClick={() => setCurrentView('onboarding')}>{t.back}</Button>
          </div>
        );

      case 'subject-select':
        return (
          <div className="min-h-screen bg-[#F0FDF4] dark:bg-stone-950 flex flex-col pb-24">
            <header className="p-6 flex justify-between items-center"><div className="flex items-center gap-3"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl border-2">{currentProfile?.avatar}</div><h2 className="text-2xl font-black dark:text-stone-100">{currentProfile?.name}</h2></div><div className="flex gap-2"><button onClick={() => setShowTimerConfig(true)} className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full"><Timer size={24} /></button><NightModeToggle /><button onClick={() => setShowPinModal(true)} className="p-3 bg-white/50 rounded-full"><Settings /></button></div></header>
            <main className="p-6 grid gap-4 max-w-md mx-auto w-full">
              <div className="flex gap-4"><Button fullWidth variant="secondary" onClick={() => setCurrentView('smart-lesson-upload')}><Camera size={24} /> {t.smartLesson}</Button><Button fullWidth variant="secondary" onClick={() => setCurrentView('library')}><Book size={24} /> {t.library}</Button></div>
              <div className="grid grid-cols-1 gap-4">
                {SUBJECTS.map(s => (
                  <button key={s.id} onClick={() => { setSelectedSubject(s); setMessages([{id: 'w', role: 'model', text: language === Language.ARABIC ? `مرحباً بك في عالم ${s.nameAr}!` : `Welcome!`, timestamp: Date.now()}]); setCurrentView('chat'); }} className={`${s.color} p-6 rounded-3xl flex items-center gap-4 hover:scale-105 transition-transform shadow-sm border-2`}><span className="text-4xl">{s.icon}</span><h4 className="text-2xl font-black">{language === Language.ARABIC ? s.nameAr : s.nameEn}</h4></button>
                ))}
                
                {/* Premium Dashboard Button - Positioned Under General Chat */}
                <button 
                  onClick={() => setCurrentView('premium-dashboard')} 
                  className="bg-gradient-to-r from-amber-400 to-amber-600 text-white p-6 rounded-3xl flex items-center gap-4 hover:scale-105 transition-transform shadow-lg border-2 border-amber-300 dark:border-amber-700 mt-2"
                >
                  <div className="bg-white/20 p-2 rounded-2xl"><Crown size={32} className="text-white" /></div>
                  <h4 className="text-2xl font-black">{t.premiumDashboard}</h4>
                </button>
              </div>
            </main>
          </div>
        );

      case 'smart-lesson-upload':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950 p-6">
            <header className="flex items-center gap-4 mb-8"><button onClick={() => { stopCamera(); setCurrentView('subject-select'); }} className="p-2 bg-white dark:bg-stone-900 rounded-full shadow-sm"><ArrowLeft /></button><h2 className="text-2xl font-black dark:text-stone-100">{t.smartLesson}</h2></header>
            <div className="max-w-xl mx-auto space-y-6">
              {isCameraActive ? (
                <div className="relative border-4 border-indigo-400 rounded-[2rem] overflow-hidden bg-black aspect-[3/4] flex items-center justify-center shadow-2xl"><video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" /><div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4"><button onClick={capturePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-indigo-500 flex items-center justify-center"><div className="w-10 h-10 bg-indigo-500 rounded-full"></div></button><button onClick={stopCamera} className="bg-red-500 text-white p-4 rounded-full"><X size={24} /></button></div></div>
              ) : (
                <div className="space-y-4">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                  <div className="relative group">
                    <div onClick={() => !lessonUploadData.image && fileInputRef.current?.click()} className={`border-4 border-dashed rounded-[2rem] h-80 flex flex-col items-center justify-center bg-white dark:bg-stone-900 transition-all ${!lessonUploadData.image ? 'cursor-pointer border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30' : 'border-indigo-400'}`}>
                      {lessonUploadData.image ? (
                        <div className="relative w-full h-full"><img src={lessonUploadData.image} className="h-full w-full object-contain rounded-[1.8rem]" /><button onClick={(e) => { e.stopPropagation(); setLessonUploadData({...lessonUploadData, image: ''}); }} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg"><X size={20} /></button></div>
                      ) : (
                        <div className="flex flex-col items-center gap-4"><div className="p-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-500"><Camera size={48} /></div><p className="font-black text-slate-500 dark:text-stone-400 text-lg">{t.uploadPage}</p></div>
                      )}
                    </div>
                    {!lessonUploadData.image && <button onClick={(e) => { e.stopPropagation(); startCamera(); }} className="absolute bottom-4 right-4 bg-indigo-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg font-bold hover:bg-indigo-600"><Camera size={18} /> {language === Language.ARABIC ? 'فتح الكاميرا' : 'Open Camera'}</button>}
                  </div>
                  <input placeholder={t.bookTitle} value={lessonUploadData.bookTitle} onChange={e => setLessonUploadData({...lessonUploadData, bookTitle: e.target.value})} className="w-full p-4 rounded-2xl border-2 dark:bg-stone-800 dark:border-stone-700 outline-none focus:border-indigo-500 font-bold dark:text-white" />
                  <Button fullWidth size="xl" onClick={handleAnalyzeLesson} disabled={!lessonUploadData.image || isLoading} className="h-16">{isLoading ? <Loader2 className="animate-spin" /> : t.analyze}</Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'lesson-view':
        return (
          <div className="min-h-screen bg-white dark:bg-stone-950 flex flex-col">
            <header className="p-4 shadow-sm flex items-center gap-4 bg-white dark:bg-stone-900 sticky top-0 z-10"><button onClick={() => setCurrentView('library')} className="p-2 bg-slate-100 dark:bg-stone-800 rounded-full"><ArrowLeft /></button><h2 className="font-bold dark:text-stone-100">{currentLesson?.title}</h2></header>
            <main className="p-6 max-w-2xl mx-auto w-full">
              {currentLesson?.imageData && <img src={currentLesson.imageData} className="w-full rounded-3xl mb-6 shadow-md border dark:border-stone-800" />}
              <div className="bg-indigo-50 dark:bg-stone-900/50 p-6 rounded-3xl mb-6 border dark:border-stone-800 shadow-sm">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400 font-bold"><Brain size={20} /> {t.tutorName}</div>
                <div className="space-y-4">
                  {messages.map(m => <ChatBubble key={m.id} message={m} language={language} voicePreference={currentProfile?.preferredVoice} speakingRate={speakingRate} />)}
                  {isLoading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-indigo-500" /></div>}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              <div className="confirm-box p-6 bg-slate-50 dark:bg-stone-900 rounded-3xl border dark:border-stone-800 mb-8">
                <p className="text-xl font-bold dark:text-stone-200 mb-4">{language === Language.ARABIC ? "هل فهمت الشرح؟" : "Did you understand?"}</p>
                <div className="flex justify-center gap-4">
                  <button className="yes-btn px-10" onClick={() => handleConfirmation(true)} disabled={isLoading}>✅ نعم</button>
                  <button className="no-btn px-10" onClick={() => handleConfirmation(false)} disabled={isLoading}>🔁 لا</button>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-4 mb-20">
                <Button fullWidth onClick={() => { 
                  setIsQuizLoading(true); 
                  setShowQuizModal(true); 
                  const lastMsg = messages.filter(m => m.role === 'model').pop()?.text || "";
                  generateLessonQuiz(lastMsg, currentProfile!, language).then(setQuizData).finally(() => setIsQuizLoading(false)); 
                }}>{t.takeQuiz}</Button>
                <Button fullWidth variant="secondary" onClick={() => { setShowLessonCompleteModal(true); setShowConfetti(true); if(currentLesson) { const updated = savedLessons.map(l => l.id === currentLesson.id ? {...l, isCompleted: true} : l); setSavedLessons(updated); localStorage.setItem('smart_tutor_lessons', JSON.stringify(updated)); } }}>{t.finishReview}</Button>
              </div>
            </main>
          </div>
        );

      case 'library':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950 p-6">
            <header className="flex items-center gap-4 mb-8"><button onClick={() => setCurrentView('subject-select')} className="p-2 bg-white dark:bg-stone-900 rounded-full shadow-sm"><ArrowLeft /></button><h2 className="text-2xl font-black dark:text-stone-100">{t.library}</h2></header>
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedLessons.map(l => (
                <div key={l.id} onClick={() => { setCurrentLesson(l); setMessages([{ id: l.id + '-stored', role: 'model', text: l.explanation, timestamp: Date.now() }]); setCurrentView('lesson-view'); }} className="bg-white dark:bg-stone-900 p-4 rounded-3xl shadow-sm flex gap-4 cursor-pointer border dark:border-stone-800"><div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden">{l.imageData && <img src={l.imageData} className="w-full h-full object-cover" />}</div><div className="flex-1"><h3 className="font-bold dark:text-stone-200">{l.title}</h3><div className="mt-2">{l.isCompleted ? <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{t.completed}</span> : <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{t.inProgress}</span>}</div></div></div>
              ))}
            </div>
          </div>
        );

      case 'chat':
        return (
          <div className="min-h-screen bg-slate-50 dark:bg-stone-950 flex flex-col">
            <header className="bg-white dark:bg-stone-900 p-4 shadow-sm flex items-center gap-4 sticky top-0 z-20"><button onClick={() => setCurrentView('subject-select')} className="p-2"><ArrowLeft /></button><div className="flex-1"><h2 className="font-bold dark:text-stone-100">{language === Language.ARABIC ? selectedSubject?.nameAr : selectedSubject?.nameEn}</h2></div><button onClick={() => setShowVoiceSettings(!showVoiceSettings)} className="p-3 bg-slate-100 dark:bg-stone-800 rounded-full"><Sliders size={20} /></button><NightModeToggle /></header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">{messages.map(m => <ChatBubble key={m.id} message={m} language={language} voicePreference={currentProfile?.preferredVoice} speakingRate={speakingRate} />)}{isLoading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-indigo-500" /></div>}<div ref={messagesEndRef} /></main>
            {showVoiceSettings && (
              <div className="absolute top-20 end-4 bg-white dark:bg-stone-900 p-6 rounded-3xl shadow-2xl border dark:border-stone-800 w-64 z-50">
                <div className="mb-6"><h4 className="font-bold mb-3 text-xs uppercase text-slate-400">{t.voice}</h4><div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-stone-800 rounded-2xl"><button onClick={() => { if(currentProfile) { const updated = {...currentProfile, preferredVoice: 'male' as VoicePreference}; setCurrentProfile(updated); setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p)); } }} className={`py-2 rounded-xl text-xs font-bold ${currentProfile?.preferredVoice === 'male' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t.male}</button><button onClick={() => { if(currentProfile) { const updated = {...currentProfile, preferredVoice: 'female' as VoicePreference}; setCurrentProfile(updated); setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p)); } }} className={`py-2 rounded-xl text-xs font-bold ${currentProfile?.preferredVoice === 'female' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{t.female}</button></div></div>
                <div><div className="flex justify-between mb-2"><h4 className="text-xs font-bold uppercase text-slate-400">{t.speakingRate}</h4><span className="text-xs font-bold text-indigo-500">{speakingRate.toFixed(1)}x</span></div><input type="range" min="0.5" max="1.5" step="0.1" value={speakingRate} onChange={(e) => setSpeakingRate(parseFloat(e.target.value))} className="w-full accent-indigo-500" /></div>
              </div>
            )}
            <div className="p-4 bg-white dark:bg-stone-900 border-t flex gap-2"><button onClick={toggleListening} className={`w-14 h-14 rounded-full flex items-center justify-center ${isListening ? 'bg-red-500 text-white' : 'bg-slate-100 dark:bg-stone-800 text-indigo-500'}`}>{isListening ? <Square size={20} /> : <Mic size={24} />}</button><input className="flex-1 bg-gray-100 dark:bg-stone-800 rounded-full px-6 outline-none font-bold" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder={t.typeMessage} /><button onClick={() => handleSendMessage()} className="bg-indigo-500 text-white w-14 h-14 rounded-full flex items-center justify-center"><Send /></button></div>
          </div>
        );
      
      default: return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>;
    }
  };

  const NightModeToggle = () => <button onClick={() => setIsNightMode(!isNightMode)} className="bg-white/20 dark:bg-stone-800 p-2 rounded-full backdrop-blur-sm shadow-sm">{isNightMode ? <Sun className="text-amber-300" size={20} /> : <Moon className="text-indigo-600" size={20} />}</button>;

  return (
    <div className={isNightMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#F0FDF4] dark:bg-stone-950 transition-colors duration-300">
        {renderCurrentView()}
        {timerStatus !== 'idle' && <div className="fixed top-24 end-6 z-[100] bg-white dark:bg-stone-900 shadow-2xl rounded-full px-5 py-3 border-2 border-indigo-400 flex items-center gap-3"><Timer className="text-indigo-500" size={24} /><span className="text-2xl font-black text-indigo-600">{formatTime(timeLeft)}</span><button onClick={() => setTimerStatus('idle')}><XCircle size={20} className="text-red-400" /></button></div>}

        {/* MODAL: QUIZ */}
        {showQuizModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-6">
            <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border-4 border-indigo-100">
              <div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black dark:text-white">{t.quizTitle}</h3><button onClick={() => { setShowQuizModal(false); setQuizFeedback('idle'); }}><X /></button></div>
              {isQuizLoading ? <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></div> : quizData && (
                <div className="space-y-6">
                  <p className="text-xl font-bold dark:text-stone-300">{quizData.question}</p>
                  <div className="grid gap-3">
                    {quizData.options?.map(o => (
                      <button key={o} onClick={() => { 
                        const isC = o === quizData.answer; 
                        setQuizFeedback(isC ? 'correct' : 'incorrect'); 
                        if(isC) {
                          setShowConfetti(true);
                          speechService.speak(language === Language.ARABIC ? "إجابة عبقرية! أحسنت" : "Genius answer!", language, currentProfile?.preferredVoice, speakingRate);
                          // Automatic transition to next part after a delay
                          setTimeout(() => {
                            setShowQuizModal(false);
                            setQuizFeedback('idle');
                            handleSendMessage(language === Language.ARABIC ? "لقد أجبت بشكل صحيح على سؤالك الأخير! ماذا الآن؟" : "I answered correctly! What is next?");
                          }, 2000);
                        }
                      }} className={`p-4 rounded-2xl border-2 font-bold transition-all ${quizFeedback === 'idle' ? 'hover:border-indigo-400 dark:border-stone-700' : o === quizData.answer ? 'bg-green-100 border-green-500 text-green-800 scale-105 shadow-md' : 'opacity-50'}`}>{o}</button>
                    ))}
                  </div>
                  {quizFeedback !== 'idle' && <div className="p-4 bg-indigo-50 dark:bg-stone-800 rounded-2xl font-bold dark:text-white animate-pulse">{quizFeedback === 'correct' ? (language === Language.ARABIC ? '🎉 إجابة صحيحة! جاري الانتقال...' : '🎉 Correct! Moving on...') : quizData.explanation}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: LESSON COMPLETE */}
        {showLessonCompleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500] flex items-center justify-center p-6">
            <div className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-10 text-center shadow-2xl border-4 border-emerald-100">
               <div className="text-7xl mb-6">🎉</div>
               <h3 className="text-3xl font-black mb-4 dark:text-white">{t.lessonCompleted}</h3>
               <p className="text-lg text-slate-600 dark:text-stone-400 mb-8">{t.greatJobLesson}</p>
               <Button fullWidth size="xl" onClick={() => { setShowLessonCompleteModal(false); setCurrentView('library'); }}>{t.backToLibrary}</Button>
            </div>
          </div>
        )}

        {showTimerConfig && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-center justify-center p-6"><div className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 w-full max-sm"><div className="flex justify-between items-center mb-6"><h3 className="text-2xl font-black dark:text-stone-100">{t.timerStart}</h3><button onClick={() => setShowTimerConfig(false)}><X /></button></div><div className="grid grid-cols-3 gap-3 mb-8">{[15, 25, 45].map(m => <button key={m} onClick={() => setTimeLeft(m * 60)} className={`p-4 rounded-2xl border-2 font-black ${timeLeft === m * 60 ? 'bg-indigo-500 text-white' : 'bg-slate-50 dark:bg-stone-800'}`}>{m}<br/><span className="text-[10px]">{t.minutes}</span></button>)}</div><Button fullWidth size="xl" onClick={() => { setTimerStatus('running'); setShowTimerConfig(false); }}><Play /> {t.letsGo}</Button></div></div>
        )}

        {showPinModal && (
          <div className="fixed inset-0 bg-black/60 z-[400] flex items-center justify-center p-6"><div className="bg-white dark:bg-stone-900 rounded-[2.5rem] p-8 shadow-2xl w-full max-w-sm"><h3 className="text-2xl font-black text-center dark:text-stone-100 mb-6">{t.parentalLock}</h3><input type="password" maxLength={4} className={`text-center text-4xl font-black w-full bg-slate-50 dark:bg-stone-800 rounded-2xl py-6 border-4 mb-4 ${isPinError ? 'border-red-400' : 'border-slate-100'}`} value={tempPin} onChange={(e) => { setTempPin(e.target.value); setIsPinError(false); }} placeholder="••••" /><div className="space-y-3"><Button fullWidth size="lg" onClick={() => { if(tempPin === '1234') { setShowPinModal(false); setCurrentView('parent-dashboard'); setTempPin(''); } else { setIsPinError(true); } }}>{t.unlock}</Button><Button fullWidth variant="ghost" onClick={() => setShowPinModal(false)}>{t.cancel}</Button></div></div></div>
        )}

        {showConfetti && <div className="fixed inset-0 pointer-events-none z-[600] flex items-center justify-center text-9xl animate-bounce">🎊</div>}
      </div>
    </div>
  );
}
