'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Folder, Calendar, CheckCircle2, Clock, FileText, 
  MoreVertical, ChevronRight, User, ArrowLeft, Plus, X, Save, 
  Settings, Trash2, Edit3, Users, Upload, Image as ImageIcon, Pencil, Search, LogOut, Lock, AlertTriangle, Paperclip, 
  Activity, ListTodo, Timer, Menu, Briefcase, Filter, LayoutList, CheckSquare 
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- HELPER: TEXT LINKIFY ---
const renderContentWithLinks = (text) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all cursor-pointer z-10 relative">
          {part}
        </a>
      );
    }
    return part;
  });
};

// --- HELPER: DEADLINE COLOR ---
const getDeadlineColorClass = (dateString) => {
  if (!dateString) return 'text-gray-400';
  const deadline = new Date(dateString);
  const today = new Date();
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  if (diffDays < 0) return 'text-red-600 font-bold'; 
  if (diffDays <= 3) return 'text-red-500 font-medium'; 
  if (diffDays <= 7) return 'text-orange-500'; 
  return 'text-gray-500';
};

// --- HELPER: STATUS STYLES ---
const getStatusStyle = (status) => {
  switch (status) {
    case 'Bearbeitung': return 'bg-green-100 text-green-700 border-green-200';
    case 'Warten auf Kundenfeedback': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Warten auf Mitarbeiter': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Erledigt': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Abgebrochen': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-100';
  }
};

const STATUS_OPTIONS = [
  'Bearbeitung', 
  'Warten auf Kundenfeedback', 
  'Warten auf Mitarbeiter', 
  'Erledigt', 
  'Abgebrochen'
];

// --- LOGIN COMPONENT ---
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); 
  const [msg, setMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else setMsg('Account erstellt! Du bist eingeloggt.');
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
        <div className="flex justify-center mb-6"><div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white"><Lock size={24} /></div></div>
        <h1 className="text-2xl font-bold text-center mb-1 text-gray-900">Agentur OS</h1>
        <p className="text-center text-gray-500 text-sm mb-8">Bitte melde dich an</p>
        <form onSubmit={handleAuth} className="space-y-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label><input type="email" required className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 outline-none focus:ring-2 focus:ring-gray-900 transition" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Passwort</label><input type="password" required minLength={6} className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 outline-none focus:ring-2 focus:ring-gray-900 transition" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {msg && <div className="text-xs text-red-500 text-center">{msg}</div>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50 transition">{loading ? 'Lade...' : (isSignUp ? 'Account erstellen' : 'Anmelden')}</button>
        </form>
        <div className="mt-6 text-center"><button onClick={() => { setIsSignUp(!isSignUp); setMsg(''); }} className="text-xs text-gray-400 hover:text-gray-900 transition">{isSignUp ? 'Zurück zum Login' : 'Noch keinen Account? Registrieren'}</button></div>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function AgenturDashboard() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  // Data States
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]); 
  const [projects, setProjects] = useState([]);
  const [allLogs, setAllLogs] = useState([]); 
  const [allTodos, setAllTodos] = useState([]);

  // UI States
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTodos, setProjectTodos] = useState([]);
  const [projectLogs, setProjectLogs] = useState([]);
  const [stats, setStats] = useState({ activeProjects: 0, openTasks: 0, nextDeadline: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({ pmId: 'Alle', showOpenTodos: false });

  // Modals & Inputs
  const [uploading, setUploading] = useState(false); 
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ title: '', message: '', action: () => {} });

  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoAssignee, setNewTodoAssignee] = useState('');
  
  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogDate, setNewLogDate] = useState(''); 
  const [newLogImage, setNewLogImage] = useState(null);
  const [isUploadingLogImage, setIsUploadingLogImage] = useState(false);

  // Edit States
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editTodoTitle, setEditTodoTitle] = useState('');
  const [editTodoAssignee, setEditTodoAssignee] = useState('');

  const [editingLogId, setEditingLogId] = useState(null);
  const [editLogTitle, setEditLogTitle] = useState('');
  const [editLogContent, setEditLogContent] = useState('');
  const [editLogDate, setEditLogDate] = useState(''); 
  const [editLogImage, setEditLogImage] = useState(null); 
  const [isUploadingEditLogImage, setIsUploadingEditLogImage] = useState(false); 

  // Modals
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null); 
  const [clientFormName, setClientFormName] = useState('');
  const [clientFormLogo, setClientFormLogo] = useState(null); 
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeFormName, setEmployeeFormName] = useState('');

  const [newProjectData, setNewProjectData] = useState({ title: '', jobNr: '', clientId: '', pmId: '', deadline: '' });
  const [editProjectData, setEditProjectData] = useState({ id: '', title: '', jobNr: '', status: '', deadline: '', google_doc_url: '', pmId: '' });

  // Refs
  const logoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const logImageInputRef = useRef(null);
  const editLogImageInputRef = useRef(null); 

  // --- INIT & FETCH ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoadingSession(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetails(selectedProject.id);
      setIsAddingTodo(false); setIsAddingLog(false); setEditingLogId(null); setEditingTodoId(null);
      setNewTodoAssignee(''); setNewLogImage(null);
      setMobileMenuOpen(false);
    }
  }, [selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    const { data: c } = await supabase.from('clients').select('*').order('name');
    if (c) setClients(c);
    const { data: e } = await supabase.from('employees').select('*').order('name');
    if (e) setEmployees(e);
    
    // FETCH PROJECTS WITH TODOS (alle Felder für Todos)
    const { data: p } = await supabase
      .from('projects')
      .select(`
        *, 
        employees ( id, name, initials ), 
        clients ( name, logo_url ), 
        todos ( * )
      `)
      .order('created_at', { ascending: false });
    
    const { data: l } = await supabase.from('project_logs').select('*, projects(title)').order('entry_date', { ascending: false });
    if(l) setAllLogs(l);
      
    if (p) {
      const allT = [];
      p.forEach(proj => {
         if(proj.todos) proj.todos.forEach(t => allT.push({...t, project_title: proj.title, project_status: proj.status, project_id: proj.id, clients: proj.clients, job_number: proj.job_number}));
      });
      setAllTodos(allT);

      const projectsWithStats = p.map(proj => {
        const totalTodos = proj.todos ? proj.todos.length : 0;
        const doneTodos = proj.todos ? proj.todos.filter(t => t.is_done).length : 0;
        const openTodosPreview = proj.todos ? proj.todos.filter(t => !t.is_done).slice(0, 3) : [];
        return { ...proj, totalTodos, doneTodos, openTodosPreview };
      });
      setProjects(projectsWithStats);

      const activeCount = projectsWithStats.filter(proj => ['Bearbeitung', 'In Umsetzung'].includes(proj.status)).length; 
      const today = new Date(); today.setHours(0,0,0,0);
      const futureProjects = projectsWithStats
        .filter(proj => proj.deadline && new Date(proj.deadline) >= today)
        .sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
      const nextDl = futureProjects.length > 0 ? futureProjects[0] : null;
      const openTaskCount = projectsWithStats.reduce((acc, curr) => acc + (curr.totalTodos - curr.doneTodos), 0);
      setStats({ activeProjects: activeCount, openTasks: openTaskCount, nextDeadline: nextDl });
    }
    setLoading(false);
  };

  const fetchProjectDetails = async (projectId) => {
    const { data: t } = await supabase.from('todos').select(`*, employees ( id, initials, name )`).eq('project_id', projectId).order('created_at', { ascending: true });
    if (t) setProjectTodos(t);
    const { data: l } = await supabase.from('project_logs').select('*').eq('project_id', projectId).order('entry_date', { ascending: false });
    if (l) setProjectLogs(l);
  };

  // --- FILE UTILS ---
  const deleteFileFromSupabase = async (fullUrl, bucket) => {
    if (!fullUrl) return;
    try { const fileName = fullUrl.split('/').pop(); if (fileName) await supabase.storage.from(bucket).remove([fileName]); } catch (e) { console.warn(e); }
  };
  const uploadFileToSupabase = async (file, bucket) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  // --- GLOBAL CONFIRM ---
  const openConfirm = (title, message, action) => { setConfirmConfig({ title, message, action }); setConfirmOpen(true); };
  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setProjects([]); };

  // --- CRUD HANDLERS ---
  const handleSaveClient = async () => { 
      if (!clientFormName.trim()) return; setUploading(true); let logoUrl = editingClient?.logo_url; 
      if (clientFormLogo) { if (logoUrl) await deleteFileFromSupabase(logoUrl, 'logos'); logoUrl = await uploadFileToSupabase(clientFormLogo, 'logos'); }
      const p = { name: clientFormName, logo_url: logoUrl };
      if (editingClient) { const {data} = await supabase.from('clients').update(p).eq('id', editingClient.id).select(); if(data) setClients(clients.map(c=>c.id===data[0].id?data[0]:c)); }
      else { const {data} = await supabase.from('clients').insert([p]).select(); if(data) setClients([...clients, data[0]].sort((a,b)=>a.name.localeCompare(b.name))); }
      setUploading(false); setClientModalOpen(false);
  };
  const requestDeleteClient = (id) => openConfirm("Kunde löschen?", "Alle Projekte werden gelöscht.", async () => { await supabase.from('clients').delete().eq('id', id); setClients(clients.filter(c=>c.id!==id)); if(selectedClient?.id===id) setSelectedClient(null); });
  const openClientModal = (c) => { setEditingClient(c); setClientFormName(c ? c.name : ''); setClientFormLogo(null); setClientModalOpen(true); };

  const handleSaveEmployee = async () => { if(!employeeFormName.trim()) return; const initials = employeeFormName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase(); const p = {name: employeeFormName, initials}; if(editingEmployee){const{data}=await supabase.from('employees').update(p).eq('id',editingEmployee.id).select(); if(data) setEmployees(employees.map(e=>e.id===data[0].id?data[0]:e));}else{const{data}=await supabase.from('employees').insert([p]).select();if(data)setEmployees([...employees,data[0]]);} setEmployeeModalOpen(false);};
  const requestDeleteEmployee = (id) => openConfirm("Löschen?", "Weg.", async () => { await supabase.from('employees').delete().eq('id', id); setEmployees(employees.filter(e=>e.id!==id)); });
  const openEmployeeModal = (e) => { setEditingEmployee(e); setEmployeeFormName(e ? e.name : ''); setEmployeeModalOpen(true); };

  const handleCreateProject = async () => { if (!newProjectData.title || !newProjectData.clientId) return alert("Pflichtfelder!"); await supabase.from('projects').insert([{ title: newProjectData.title, job_number: newProjectData.jobNr, client_id: newProjectData.clientId, project_manager_id: newProjectData.pmId || null, deadline: newProjectData.deadline || null, status: 'Bearbeitung' }]); fetchData(); setIsCreatingProject(false); };
  
  // FIX: Mapping der Daten für das Update
  const handleUpdateProject = async () => { 
      const updates = {
          title: editProjectData.title,
          job_number: editProjectData.jobNr,
          status: editProjectData.status,
          deadline: editProjectData.deadline || null,
          google_doc_url: editProjectData.google_doc_url,
          project_manager_id: editProjectData.pmId || null
      };

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', editProjectData.id)
        .select(`
            *, 
            employees ( id, name, initials ), 
            clients ( name, logo_url ), 
            todos ( * )
        `); 
      
      if (data) { 
          // Update lokalen State
          setProjects(prev => prev.map(p => p.id === data[0].id ? { ...p, ...data[0] } : p)); 
          // Update selected view
          setSelectedProject(data[0]); 
          setIsEditingProject(false); 
          // Refresh global stats
          fetchData();
      }
  };

  const requestDeleteProject = () => openConfirm("Projekt löschen?", "Sicher?", async () => { await supabase.from('projects').delete().eq('id', selectedProject.id); setProjects(prev => prev.filter(p => p.id !== selectedProject.id)); setSelectedProject(null); });
  const handlePdfUpload = async (e) => { const file = e.target.files[0]; if(!file) return; setUploading(true); const url = await uploadFileToSupabase(file, 'documents'); await supabase.from('projects').update({offer_pdf_url: url}).eq('id', selectedProject.id); setSelectedProject(prev => ({...prev, offer_pdf_url: url})); setUploading(false); };
  const openEditModal = () => { setEditProjectData({ id: selectedProject.id, title: selectedProject.title, jobNr: selectedProject.job_number, status: selectedProject.status, deadline: selectedProject.deadline || '', google_doc_url: selectedProject.google_doc_url || '', pmId: selectedProject.project_manager_id || '' }); setIsEditingProject(true); };

  // Todos
  const handleAddTodo = async () => { if(!newTodoTitle.trim()) return; const {data} = await supabase.from('todos').insert([{project_id: selectedProject.id, title: newTodoTitle, assigned_to: newTodoAssignee || null}]).select(`*, employees(id, initials, name)`); if(data) { setProjectTodos([...projectTodos, data[0]]); setNewTodoTitle(''); setIsAddingTodo(false); fetchData(); }};
  const toggleTodo = async (id, status) => { 
      setProjectTodos(prev => prev.map(t => t.id === id ? {...t, is_done: !status} : t)); 
      await supabase.from('todos').update({is_done: !status}).eq('id', id); 
      fetchData(); 
  };
  const handleUpdateTodo = async (id) => { if(!editTodoTitle.trim()) return; const {data} = await supabase.from('todos').update({title: editTodoTitle, assigned_to: editTodoAssignee || null}).eq('id', id).select(`*, employees(id, initials, name)`); if(data) { setProjectTodos(prev => prev.map(t => t.id === id ? data[0] : t)); setEditingTodoId(null); fetchData(); }};
  const requestDeleteTodo = (id) => openConfirm("Löschen?", "Weg.", async () => { await supabase.from('todos').delete().eq('id', id); setProjectTodos(prev => prev.filter(t => t.id !== id)); fetchData(); });
  const startEditingTodo = (todo) => { setEditingTodoId(todo.id); setEditTodoTitle(todo.title); setEditTodoAssignee(todo.assigned_to || ''); };
  const cancelEditingTodo = () => { setEditingTodoId(null); setEditTodoTitle(''); setEditTodoAssignee(''); };
  
  // Direct Assignee Update (Global List)
  const handleAssigneeUpdateGlobal = async (todoId, newAssigneeId) => {
      const target = newAssigneeId === "" ? null : newAssigneeId;
      await supabase.from('todos').update({ assigned_to: target }).eq('id', todoId);
      fetchData(); 
  };
  const handleGlobalToggle = async (todoId, status) => {
      await supabase.from('todos').update({ is_done: !status }).eq('id', todoId);
      fetchData();
  }

  // Logs
  const handleAddLog = async () => { if(!newLogTitle.trim()) return; const {data} = await supabase.from('project_logs').insert([{project_id: selectedProject.id, title: newLogTitle, content: newLogContent, image_url: newLogImage, entry_date: newLogDate || new Date().toISOString()}]).select(); if(data) { setProjectLogs([data[0], ...projectLogs].sort((a,b)=>new Date(b.entry_date)-new Date(a.entry_date))); setNewLogTitle(''); setNewLogContent(''); setNewLogImage(null); setIsAddingLog(false); }};
  const handleLogImageUpload = async (f) => { setIsUploadingLogImage(true); try { const url = await uploadFileToSupabase(f, 'documents'); setNewLogImage(url); } catch(e){} setIsUploadingLogImage(false); };
  const handlePaste = (e) => { if(e.clipboardData.files.length > 0) { e.preventDefault(); handleLogImageUpload(e.clipboardData.files[0]); }};
  const requestDeleteLog = (id) => openConfirm("Löschen?", "Weg.", async () => { await supabase.from('project_logs').delete().eq('id', id); setProjectLogs(prev => prev.filter(l => l.id !== id)); });
  const handleUpdateLog = async (id) => { if(!editLogTitle.trim()) return; const {data} = await supabase.from('project_logs').update({title: editLogTitle, content: editLogContent, entry_date: editLogDate, image_url: editLogImage}).eq('id', id).select(); if(data) { setProjectLogs(prev => prev.map(l => l.id === id ? data[0] : l).sort((a,b)=>new Date(b.entry_date)-new Date(a.entry_date))); setEditingLogId(null); }};
  const handleEditLogImageUpload = async (f) => { setIsUploadingEditLogImage(true); try { const url = await uploadFileToSupabase(f, 'documents'); setEditLogImage(url); } catch(e){} setIsUploadingEditLogImage(false); };
  const startEditingLog = (log) => { setEditingLogId(log.id); setEditLogTitle(log.title); setEditLogContent(log.content); setEditLogImage(log.image_url); const dateStr = new Date(log.entry_date).toISOString().split('T')[0]; setEditLogDate(dateStr); };
  const cancelEditingLog = () => { setEditingLogId(null); setEditLogTitle(''); setEditLogContent(''); setEditLogDate(''); setEditLogImage(null); };


  // --- SEARCH LOGIC ---
  const searchResults = useMemo(() => {
    if (!searchTerm) return null;
    const lower = searchTerm.toLowerCase();
    const foundProjects = projects.filter(p => p.title?.toLowerCase().includes(lower) || p.job_number?.toLowerCase().includes(lower) || p.clients?.name?.toLowerCase().includes(lower));
    const foundTodos = allTodos.filter(t => t.title?.toLowerCase().includes(lower));
    const foundLogs = allLogs.filter(l => l.title?.toLowerCase().includes(lower) || l.content?.toLowerCase().includes(lower));
    return { projects: foundProjects, todos: foundTodos, logs: foundLogs };
  }, [searchTerm, projects, allTodos, allLogs]);

  // --- FILTER LOGIC ---
  const filteredProjects = projects.filter(p => {
    // Basic
    if (selectedClient && p.client_id !== selectedClient.id) return false;
    if (statusFilter !== 'Alle' && p.status !== statusFilter) return false;
    if (searchTerm) {
       const lower = searchTerm.toLowerCase();
       return p.title?.toLowerCase().includes(lower) || p.job_number?.toLowerCase().includes(lower) || p.clients?.name?.toLowerCase().includes(lower);
    }
    
    // Advanced Filters
    if (advancedFilters.pmId !== 'Alle' && p.project_manager_id !== advancedFilters.pmId) return false;
    if (advancedFilters.showOpenTodos) {
      // Check if project has open todos
      const hasOpen = p.todos && p.todos.some(t => !t.is_done);
      if (!hasOpen) return false;
    }

    return true;
  });

  // --- GLOBAL TASKS LOGIC ---
  const getTasksByProject = () => {
    const list = [];
    projects.forEach(proj => {
       // Filter for open todos using the project's own todo list (already fetched with *)
       const openTodos = proj.todos ? proj.todos.filter(t => !t.is_done) : [];
       if (openTodos.length > 0) {
           list.push({ ...proj, visibleTodos: openTodos });
       }
    });
    return list;
  };

  if (loadingSession) return <div className="flex h-screen items-center justify-center text-gray-400 font-medium">Lade App...</div>;
  if (!session) return <LoginScreen />;

  return (
    // --- FIXED LAYOUT WITH SCROLL AREAS ---
    <div className="flex h-screen w-full bg-[#F9FAFB] text-gray-900 font-sans overflow-hidden">
      
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)}></div>}

      {/* SIDEBAR: Independent Scroll */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto flex-shrink-0 transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
        <div className="p-6 flex-1 flex flex-col min-h-min">
          <div className="md:hidden flex justify-end mb-4"><button onClick={() => setMobileMenuOpen(false)} className="p-2 text-gray-500"><X size={24}/></button></div>

          {/* NAVIGATION */}
          <div className="mb-8 space-y-1">
             <button onClick={() => { fetchData(); setCurrentView('dashboard'); setSelectedClient(null); setSelectedProject(null); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-3 transition ${currentView === 'dashboard' && !selectedClient ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                <LayoutList size={18}/> Übersicht
             </button>
             <button onClick={() => { fetchData(); setCurrentView('global_tasks'); setSelectedProject(null); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-3 transition ${currentView === 'global_tasks' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50'}`}>
                <CheckSquare size={18}/> Offene Aufgaben
             </button>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-black text-gray-900 uppercase tracking-widest flex items-center gap-2"><Briefcase size={16}/> Kunden</h2>
            <button onClick={() => { setEditingClient(null); setClientFormName(''); setClientFormLogo(null); setClientModalOpen(true); }} className="text-gray-400 hover:text-gray-900 transition"><Plus size={16}/></button>
          </div>
          <nav className="space-y-3 mb-8">
            <button onClick={() => { fetchData(); setSelectedClient(null); setSelectedProject(null); setCurrentView('dashboard'); setMobileMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition ${!selectedClient && currentView === 'dashboard' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>Alle Kunden</button>
            {clients.map(client => (
              <div key={client.id} className="group flex items-center pr-2 rounded-lg transition hover:bg-gray-50">
                <button onClick={() => { setSelectedClient(client); setSelectedProject(null); setCurrentView('dashboard'); setMobileMenuOpen(false); }} className={`flex-1 text-left px-2 py-2 text-sm font-medium flex items-center gap-3 ${selectedClient?.id === client.id ? 'bg-gray-100 text-gray-900 rounded-lg' : 'text-gray-600'}`}>
                   {client.logo_url ? <div className="w-10 h-10 bg-white rounded-md border border-gray-100 flex items-center justify-center p-0.5 shrink-0 shadow-sm"><img src={client.logo_url} className="w-full h-full object-contain"/></div> : <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 shrink-0 font-bold">{client.name.substring(0,2).toUpperCase()}</div>}
                   <span className="truncate font-semibold">{client.name}</span>
                </button>
                <button onClick={() => openClientModal(client)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600"><Settings size={14}/></button>
              </div>
            ))}
          </nav>
          
          <div className="flex justify-between items-center mb-3 mt-8 pt-6 border-t border-gray-100">
            <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Users size={12}/> Team</h2>
            <button onClick={() => openEmployeeModal(null)} className="text-gray-300 hover:text-gray-600 transition"><Plus size={12}/></button>
          </div>
           <div className="space-y-1 mb-auto">
            {employees.map(emp => (
              <div key={emp.id} className="group flex justify-between items-center px-2 py-1 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-500 font-medium shrink-0">{emp.initials}</div>
                  <span className="text-xs text-gray-500 truncate group-hover:text-gray-900">{emp.name}</span>
                </div>
                 <button onClick={() => openEmployeeModal(emp)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600"><Pencil size={10}/></button>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-gray-100 mt-4"><button onClick={handleLogout} className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-600 w-full px-2 py-2 rounded transition hover:bg-red-50"><LogOut size={14} /> Abmelden</button></div>
        </div>
      </aside>

      {/* MAIN CONTENT: Independent Scroll */}
      <main className="flex-1 h-full overflow-y-auto p-4 md:p-8">
        <div className="md:hidden flex items-center justify-between mb-6"><button onClick={() => setMobileMenuOpen(true)} className="p-2 text-gray-600 bg-white border border-gray-200 rounded-lg"><Menu size={20}/></button><div className="font-bold text-lg">Agentur OS</div><div className="w-10"></div></div>

        {searchTerm && searchResults ? (
           // --- SEARCH RESULTS ---
           <div className="space-y-8">
             <header className="flex items-center gap-4 mb-8">
               <button onClick={() => setSearchTerm('')} className="flex items-center text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={16} className="mr-1"/> Suche beenden</button>
               <h1 className="text-xl font-bold">Suchergebnisse für "{searchTerm}"</h1>
             </header>
             <section>
               <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Projekte ({searchResults.projects.length})</h2>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {searchResults.projects.map(p => (
                   <div key={p.id} onClick={() => { setSelectedProject(p); setSearchTerm(''); }} className="bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-500 cursor-pointer transition">
                     <div className="font-bold mb-1">{p.title}</div>
                     <div className="text-xs text-gray-500">{p.job_number}</div>
                   </div>
                 ))}
                 {searchResults.projects.length === 0 && <div className="text-sm text-gray-400 italic">Keine Projekte gefunden.</div>}
               </div>
             </section>
             <section>
               <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Aufgaben ({searchResults.todos.length})</h2>
               <div className="space-y-2">
                 {searchResults.todos.map(t => (
                   <div key={t.id} onClick={() => {const proj = projects.find(p=>p.id===t.project_id); if(proj) {setSelectedProject(proj); setSearchTerm('');}}} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center cursor-pointer hover:border-blue-400 transition">
                     <div><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-gray-400">Projekt: {t.project_title}</div></div>
                     <span className={`text-xs px-2 py-1 rounded-full ${t.is_done ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{t.is_done ? 'Fertig' : 'Offen'}</span>
                   </div>
                 ))}
                  {searchResults.todos.length === 0 && <div className="text-sm text-gray-400 italic">Keine Aufgaben gefunden.</div>}
               </div>
             </section>
              <section>
               <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">Logbuch ({searchResults.logs.length})</h2>
               <div className="space-y-4">
                 {searchResults.logs.map(l => (
                   <div key={l.id} onClick={() => {const proj = projects.find(p=>p.id===l.project_id); if(proj) {setSelectedProject(proj); setSearchTerm('');}}} className="bg-white p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-blue-400 transition">
                     <div className="flex justify-between mb-2"><span className="text-xs font-bold text-gray-500">{new Date(l.entry_date).toLocaleDateString()}</span><span className="text-xs text-blue-600 font-medium">{l.projects?.title}</span></div>
                     <div className="font-bold text-sm mb-1">{l.title}</div>
                     <div className="text-sm text-gray-600 line-clamp-2">{l.content}</div>
                   </div>
                 ))}
                  {searchResults.logs.length === 0 && <div className="text-sm text-gray-400 italic">Keine Einträge gefunden.</div>}
               </div>
             </section>
           </div>
        ) : selectedProject ? (
          /* --- DETAIL VIEW --- */
          <>
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
              <button onClick={() => { fetchData(); setSelectedProject(null); }} className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"><ArrowLeft size={16} className="mr-1" /> Zurück zur Übersicht</button>
              <div className="flex gap-2 self-end">
                <button onClick={requestDeleteProject} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={18} /></button>
                <button onClick={openEditModal} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"><Settings size={16} /> Einstellungen</button>
              </div>
            </div>
            {/* ... Rest of Detail View ... */}
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4"><div><div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{selectedProject.job_number}</div><h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2 break-words">{selectedProject.title}</h1><span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(selectedProject.status)}`}>{selectedProject.status}</span></div><div className="text-left md:text-right w-full md:w-auto"><div className="text-sm text-gray-500 mb-1">Projektmanager</div><div className="flex items-center justify-start md:justify-end gap-2"><span className="text-sm font-medium">{selectedProject.employees?.name || 'Nicht zugewiesen'}</span><div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs text-white shrink-0">{selectedProject.employees?.initials || '--'}</div></div><div className={`mt-2 text-xs font-medium ${getDeadlineColorClass(selectedProject.deadline)}`}>Deadline: {selectedProject.deadline || '-'}</div></div></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[calc(100vh-200px)]">
              {/* LOGBOOK */}
              <div className="flex flex-col h-[500px] lg:h-full bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 overflow-hidden order-2 lg:order-1"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Clock size={20} className="text-gray-400"/> Logbuch</h2>{isAddingLog && (<div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200"><input type="date" className="w-full bg-transparent border-none text-xs text-gray-500 font-bold mb-2 focus:ring-0 p-0" value={newLogDate} onChange={(e) => setNewLogDate(e.target.value)} /><input type="text" placeholder="Titel" className="w-full bg-transparent border-none text-sm font-semibold mb-2 focus:ring-0 p-0" value={newLogTitle} onChange={(e) => setNewLogTitle(e.target.value)} /><textarea placeholder="Text..." className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-24" value={newLogContent} onChange={(e) => setNewLogContent(e.target.value)} onPaste={handlePaste} />{isUploadingLogImage && <div className="text-xs text-blue-500 mb-2">Lade Bild hoch...</div>}{newLogImage && <div className="relative w-16 h-16 mb-2 group"><img src={newLogImage} className="w-full h-full object-cover rounded-lg border border-gray-200" /><button onClick={() => setNewLogImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button></div>}<div className="flex justify-between items-center mt-2 border-t border-gray-200 pt-2"><button onClick={() => logImageInputRef.current?.click()} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition"><ImageIcon size={16}/></button><input type="file" accept="image/*" ref={logImageInputRef} className="hidden" onChange={(e) => handleLogImageUpload(e.target.files[0])} /><div className="flex gap-2"><button onClick={() => setIsAddingLog(false)} className="text-xs text-gray-500 px-3 py-1 hover:bg-gray-200 rounded-md">Abbrechen</button><button onClick={handleAddLog} disabled={isUploadingLogImage} className="text-xs bg-gray-900 text-white px-3 py-1 rounded-md shadow-sm disabled:opacity-50">Speichern</button></div></div></div>)}<div className="overflow-y-auto pr-2 space-y-6 flex-1 relative"><div className="absolute left-[7px] top-2 bottom-0 w-[1px] bg-gray-100"></div>{!isAddingLog && <button onClick={() => { setIsAddingLog(true); setNewLogDate(new Date().toISOString().split('T')[0]); }} className="relative ml-6 mb-4 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition"><Plus size={14} /> Eintrag hinzufügen</button>}{projectLogs.map((log) => (<div key={log.id} className="relative pl-6 pb-2 group"><div className="absolute left-0 top-1.5 w-3.5 h-3.5 bg-gray-200 rounded-full border-2 border-white"></div>{editingLogId === log.id ? (<div className="bg-gray-50 p-3 rounded-xl border border-blue-200 -ml-2"><input type="date" className="w-full bg-transparent border-none text-xs text-gray-500 font-bold mb-2 focus:ring-0 p-0" value={editLogDate} onChange={(e) => setEditLogDate(e.target.value)} /><input autoFocus type="text" className="w-full bg-transparent border-none text-sm font-semibold mb-1 focus:ring-0 p-0" value={editLogTitle} onChange={(e) => setEditLogTitle(e.target.value)} /><textarea className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-16" value={editLogContent} onChange={(e) => setEditLogContent(e.target.value)} />{isUploadingEditLogImage && <div className="text-xs text-blue-500 mb-2">Lade Bild hoch...</div>}{editLogImage && <div className="relative w-16 h-16 mb-2 group"><img src={editLogImage} className="w-full h-full object-cover rounded-lg border border-gray-200" /><button onClick={() => setEditLogImage(null)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"><X size={10}/></button></div>}<div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200"><button onClick={() => editLogImageInputRef.current?.click()} className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition"><ImageIcon size={16}/></button><input type="file" accept="image/*" ref={editLogImageInputRef} className="hidden" onChange={(e) => handleEditLogImageUpload(e.target.files[0])} /><div className="flex gap-2"><button onClick={() => {setEditingLogId(null);}} className="text-xs text-gray-500 hover:text-gray-700">Abbrechen</button><button onClick={() => handleUpdateLog(log.id)} disabled={isUploadingEditLogImage} className="text-xs bg-gray-900 text-white px-3 py-1 rounded shadow-sm disabled:opacity-50">Update</button></div></div></div>) : (<div className="pr-4 relative"><div className="text-xs font-bold text-gray-500 mb-0.5">{new Date(log.entry_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}</div><div className="text-sm font-medium text-gray-900">{log.title}</div><div className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">{renderContentWithLinks(log.content)}</div>{log.image_url && <div className="mt-3"><a href={log.image_url} target="_blank" rel="noreferrer"><img src={log.image_url} className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition cursor-zoom-in" /></a></div>}<div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white pl-2"><button onClick={() => { setEditingLogId(log.id); setEditLogTitle(log.title); setEditLogContent(log.content); setEditLogImage(log.image_url); setEditLogDate(new Date(log.entry_date).toISOString().split('T')[0]); }} className="text-gray-400 hover:text-blue-600"><Pencil size={12} /></button><button onClick={() => requestDeleteLog(log.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12} /></button></div></div>)}</div>))}</div></div>
              <div className="flex flex-col gap-6 h-full order-1 lg:order-2">
                <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[300px]"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><CheckCircle2 size={20} className="text-gray-400"/> Aufgaben</h2><div className="overflow-y-auto pr-2 space-y-3 flex-1">{projectTodos.map((todo) => (<div key={todo.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 group transition">{editingTodoId === todo.id ? (<div className="flex flex-1 items-center gap-2 flex-wrap"><input autoFocus type="text" className="flex-1 min-w-[120px] bg-gray-50 rounded border-none text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editTodoTitle} onChange={(e) => setEditTodoTitle(e.target.value)} /><select className="w-24 bg-gray-50 rounded border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500" value={editTodoAssignee} onChange={(e) => setEditTodoAssignee(e.target.value)}><option value="">Niemand</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><div className="flex gap-1"><button onClick={() => handleUpdateTodo(todo.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><CheckCircle2 size={16}/></button><button onClick={() => setEditingTodoId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={16}/></button></div></div>) : (<><div className="flex items-center gap-3"><button onClick={() => toggleTodo(todo.id, todo.is_done)} className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${todo.is_done ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}>{todo.is_done && <CheckCircle2 size={12} className="text-white" />}</button><span className={`text-sm transition-all ${todo.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{todo.title}</span></div><div className="flex items-center gap-2">{todo.employees && <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold shrink-0" title={todo.employees.name}>{todo.employees.initials}</div>}<div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity"><button onClick={() => { setEditingTodoId(todo.id); setEditTodoTitle(todo.title); setEditTodoAssignee(todo.assigned_to || ''); }} className="p-1 text-gray-300 hover:text-blue-500"><Pencil size={12}/></button><button onClick={() => requestDeleteTodo(todo.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={12}/></button></div></div></>)}</div>))}{isAddingTodo ? (<div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-top-1 flex-wrap"><input autoFocus type="text" placeholder="Aufgabe..." className="flex-1 min-w-[120px] bg-transparent border-none text-sm focus:ring-0 p-1" value={newTodoTitle} onChange={(e) => setNewTodoTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()} /><select className="w-24 bg-transparent border-none text-xs text-gray-500 focus:ring-0 cursor-pointer" value={newTodoAssignee} onChange={(e) => setNewTodoAssignee(e.target.value)}><option value="">Niemand</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><div className="flex gap-1"><button onClick={handleAddTodo} className="text-blue-600 hover:bg-blue-100 p-1 rounded"><Plus size={16}/></button><button onClick={() => setIsAddingTodo(false)} className="text-gray-400 hover:bg-gray-200 p-1 rounded"><X size={16}/></button></div></div>) : ( <button onClick={() => setIsAddingTodo(true)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mt-4 pl-1 transition"><Plus size={14} /> Neue Aufgabe</button> )}</div></div>
                <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col h-48"><h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FileText size={20} className="text-gray-400"/> Projektdetails</h2><div className="flex-1 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group">{uploading ? <div className="animate-pulse text-sm">Lade Datei hoch...</div> : selectedProject.offer_pdf_url ? (<div className="flex items-center gap-4 w-full justify-center"><a href={selectedProject.offer_pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 hover:bg-gray-100 transition"><FileText size={16}/> Angebot ansehen</a><button onClick={() => pdfInputRef.current?.click()} className="text-xs text-gray-400 hover:text-gray-600">Ändern</button></div>) : ( <button onClick={() => pdfInputRef.current?.click()} className="flex items-center gap-2 text-sm text-blue-600 hover:underline"><Upload size={16}/> PDF hochladen</button> )}<input type="file" accept="application/pdf" ref={pdfInputRef} className="hidden" onChange={handlePdfUpload} /></div><div className="mt-4 pt-4 border-t border-gray-100">{selectedProject.google_doc_url ? ( <a href={selectedProject.google_doc_url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full text-blue-600 bg-blue-50 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition">Google Doc öffnen ↗</a> ) : ( <div className="text-center text-sm text-gray-400">Kein Google Doc verknüpft</div> )}</div></div>
              </div>
            </div>
          </>
        ) : (
          currentView === 'global_tasks' ? (
             /* --- GLOBAL TASKS LIST VIEW (NEW) --- */
             <div className="p-0">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <div><h1 className="text-2xl font-bold tracking-tight mb-1">Offene Aufgaben</h1><p className="text-gray-500 text-sm">Alle To-Dos im Überblick</p></div>
                </header>
                <div className="space-y-6 pb-12">
                   {getTasksByProject().length === 0 && <div className="text-center p-12 text-gray-400">Keine offenen Aufgaben gefunden.</div>}
                   {getTasksByProject().map((project) => (
                      <div key={project.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                         {/* PROJECT HEADER */}
                         <div 
                            onClick={() => { setSelectedProject(project); }} 
                            className="bg-gray-50 px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-100 transition border-b border-gray-100"
                         >
                            {/* CLIENT LOGO */}
                            {project.clients?.logo_url ? (
                                <div className="w-10 h-10 bg-white rounded-md border border-gray-200 flex items-center justify-center p-0.5 shrink-0 shadow-sm">
                                    <img src={project.clients.logo_url} className="w-full h-full object-contain"/>
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-md bg-white border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 shrink-0 font-bold">
                                    {project.clients?.name ? project.clients.name.substring(0,2).toUpperCase() : '??'}
                                </div>
                            )}
                            
                            <div>
                                <div className="font-bold text-gray-900 text-lg">{project.title}</div>
                                <div className="text-xs text-gray-500 font-mono">{project.job_number}</div>
                            </div>
                            <div className="ml-auto">
                                <ChevronRight size={20} className="text-gray-300"/>
                            </div>
                         </div>

                         {/* TASK LIST */}
                         <div className="divide-y divide-gray-100">
                            {project.visibleTodos.map((t) => (
                                <div key={t.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition group">
                                    <div className="flex items-center gap-3 flex-1">
                                        <button 
                                            onClick={() => handleGlobalToggle(t.id, t.is_done)} 
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-all flex-shrink-0 ${t.is_done ? 'bg-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}`}
                                        >
                                            {t.is_done && <CheckCircle2 size={12} className="text-white" />}
                                        </button>
                                        <span className={`text-sm text-gray-700 ${t.is_done ? 'line-through text-gray-400' : ''}`}>{t.title}</span>
                                    </div>

                                    {/* ASSIGNEE SELECTOR */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="relative">
                                            <select 
                                                className="appearance-none pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                                                value={t.assigned_to || ''}
                                                onChange={(e) => handleAssigneeUpdateGlobal(t.id, e.target.value)}
                                            >
                                                <option value="">Nicht zugewiesen</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                            </select>
                                            <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                                        </div>
                                    </div>
                                </div>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          ) : (
          /* --- DASHBOARD VIEW --- */
          <>
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div><h1 className="text-2xl font-bold tracking-tight mb-1">{selectedClient ? selectedClient.name : 'Alle Projekte'}</h1><p className="text-gray-500 text-sm">Übersicht aller laufenden Jobs</p></div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Suchen..." className="w-full md:w-64 pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                <button onClick={() => setIsCreatingProject(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-gray-800 transition flex items-center gap-2 whitespace-nowrap"><Plus size={16} /> <span className="hidden md:inline">Neues Projekt</span></button>
              </div>
            </header>

            {!selectedClient && !searchTerm && statusFilter === 'Alle' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Activity size={24}/></div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.activeProjects}</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Aktive Projekte</div>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><ListTodo size={24}/></div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{stats.openTasks}</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Offene Aufgaben</div>
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><Timer size={24}/></div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 line-clamp-1">{stats.nextDeadline ? stats.nextDeadline.title : 'Keine Deadlines'}</div>
                    <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                      {stats.nextDeadline ? `Deadline: ${new Date(stats.nextDeadline.deadline).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}` : 'Alles erledigt'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {['Alle', ...STATUS_OPTIONS].map(filter => (
                <button key={filter} onClick={() => setStatusFilter(filter)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${statusFilter === filter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>{filter}</button>
              ))}
              
              {/* ADVANCED FILTER BUTTON */}
              <div className="ml-auto relative">
                  <button onClick={() => setShowFilterModal(!showFilterModal)} className={`p-1.5 rounded-full border transition ${showFilterModal || advancedFilters.pmId !== 'Alle' || advancedFilters.showOpenTodos ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>
                      <Filter size={16}/>
                  </button>
                  {showFilterModal && (
                      <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-4 z-20 animate-in zoom-in-95 duration-200">
                          <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold uppercase text-gray-400">Filter</span><X size={14} className="cursor-pointer text-gray-400" onClick={()=>setShowFilterModal(false)}/></div>
                          <div className="space-y-4">
                              <div>
                                  <label className="text-xs font-semibold text-gray-600 block mb-1">Projektmanager</label>
                                  <select className="w-full text-sm border border-gray-200 rounded-lg p-2 bg-gray-50" value={advancedFilters.pmId} onChange={(e) => setAdvancedFilters({...advancedFilters, pmId: e.target.value})}>
                                      <option value="Alle">Alle</option>
                                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                  </select>
                              </div>
                              <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-gray-600">Nur mit offenen To-Dos</label>
                                  <input type="checkbox" checked={advancedFilters.showOpenTodos} onChange={(e) => setAdvancedFilters({...advancedFilters, showOpenTodos: e.target.checked})} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                              </div>
                              <button onClick={() => { setAdvancedFilters({pmId: 'Alle', showOpenTodos: false}); }} className="w-full text-xs text-gray-400 hover:text-red-500 pt-2 border-t border-gray-100 mt-2">Filter zurücksetzen</button>
                          </div>
                      </div>
                  )}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Job Nr</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Projekt Titel</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">PM</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Deadline</th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProjects.map((project, index) => (
                    <React.Fragment key={project.id}>
                    <tr onClick={() => setSelectedProject(project)} className={`${index % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-gray-100 transition group cursor-pointer`}>
                      <td className="py-3 px-4 text-sm text-gray-500 font-mono align-top">{project.job_number}</td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 align-top">
                        <div className="flex items-center gap-3">
                            {!selectedClient && project.clients?.logo_url ? <div className="w-8 h-8 rounded-md bg-white border border-gray-100 flex items-center justify-center p-0.5 shrink-0 shadow-sm"><img src={project.clients.logo_url} className="w-full h-full object-contain"/></div> : !selectedClient && <div className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400 shrink-0 font-bold">{project.clients?.name.substring(0,2).toUpperCase()}</div>}
                            <span>{project.title}</span>
                        </div>
                        {/* SHOW OPEN TODOS IF FILTER ACTIVE */}
                        {advancedFilters.showOpenTodos && project.openTodosPreview && project.openTodosPreview.length > 0 && (
                            <div className="mt-3 ml-11 space-y-1">
                                {project.openTodosPreview.map(t => (
                                    <div key={t.id} className="flex items-center gap-2 text-xs text-gray-500">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400"></div>
                                        {t.title} <span className="text-gray-300">({t.employees?.initials || 'Unassigned'})</span>
                                    </div>
                                ))}
                                {project.totalTodos - project.doneTodos > 3 && <div className="text-[10px] text-gray-400 pl-3.5">...und {project.totalTodos - project.doneTodos - 3} weitere</div>}
                            </div>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top"><div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold shrink-0" title={project.employees?.name}>{project.employees?.initials || '-'}</div></td>
                      <td className="py-3 px-4 align-top"><span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusStyle(project.status)}`}>{project.status}</span></td>
                      <td className={`py-3 px-4 text-sm text-right align-top ${getDeadlineColorClass(project.deadline)}`}>{project.deadline}</td>
                      <td className="py-3 px-4 text-gray-400 group-hover:text-gray-600 align-top"><ChevronRight size={16} /></td>
                    </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {filteredProjects.length === 0 && <div className="p-12 text-center text-gray-400 text-sm">Keine Projekte gefunden.</div>}
            </div>
          </>
        ))}
      </main>

      {/* MODALS (UNCHANGED) */}
      {/* Confirm */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4"><AlertTriangle size={24} /></div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{confirmConfig.title}</h3>
              <p className="text-sm text-gray-500 mb-6">{confirmConfig.message}</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Abbrechen</button>
                <button onClick={() => { confirmConfig.action(); setConfirmOpen(false); }} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 shadow-sm transition">Löschen</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Client Modal */}
      {clientModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{editingClient ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2><button onClick={() => setClientModalOpen(false)}><X size={20} className="text-gray-400"/></button></div>
             <div className="space-y-4">
               <div><label className="text-xs font-semibold text-gray-500 uppercase">Firmenname</label><input autoFocus type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50 mt-1" value={clientFormName} onChange={(e) => setClientFormName(e.target.value)} /></div>
               <div><label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Logo (Optional)</label><div className="flex items-center gap-2"><button onClick={() => logoInputRef.current?.click()} className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 text-gray-600"><ImageIcon size={14} /> {clientFormLogo ? 'Datei gewählt' : 'Logo wählen'}</button>{editingClient?.logo_url && !clientFormLogo && <span className="text-xs text-green-600">Aktuelles Logo vorhanden</span>}</div><input type="file" accept="image/*" ref={logoInputRef} className="hidden" onChange={(e) => setClientFormLogo(e.target.files[0])} /></div>
               <div className="pt-2 flex gap-3">{editingClient && <button onClick={() => { requestDeleteClient(editingClient.id); setClientModalOpen(false); }} className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button>}<button onClick={handleSaveClient} disabled={uploading} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50">{uploading ? 'Speichert...' : 'Speichern'}</button></div>
             </div>
          </div>
        </div>
      )}
      {/* Employee Modal */}
      {employeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">{editingEmployee ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'}</h2><button onClick={() => setEmployeeModalOpen(false)}><X size={20} className="text-gray-400"/></button></div>
             <div className="space-y-4">
               <div><label className="text-xs font-semibold text-gray-500 uppercase">Name</label><input autoFocus type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50 mt-1" value={employeeFormName} onChange={(e) => setEmployeeFormName(e.target.value)} /></div>
               <div className="pt-2 flex gap-3">{editingEmployee && <button onClick={() => { requestDeleteEmployee(editingEmployee.id); setEmployeeModalOpen(false); }} className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"><Trash2 size={16}/></button>}<button onClick={handleSaveEmployee} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg">Speichern</button></div>
             </div>
          </div>
        </div>
      )}
      {/* Project Create */}
      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Neues Projekt anlegen</h2><button onClick={() => setIsCreatingProject(false)}><X size={20} className="text-gray-400"/></button></div>
            <div className="space-y-4">
              <div><label className="text-xs font-semibold text-gray-500 uppercase">Kunde</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={newProjectData.clientId} onChange={(e) => setNewProjectData({...newProjectData, clientId: e.target.value})}><option value="">Bitte wählen...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={newProjectData.jobNr} onChange={(e) => setNewProjectData({...newProjectData, jobNr: e.target.value})} /></div><div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={newProjectData.title} onChange={(e) => setNewProjectData({...newProjectData, title: e.target.value})} /></div></div>
              <div><label className="text-xs font-semibold text-gray-500 uppercase">Projektmanager</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={newProjectData.pmId} onChange={(e) => setNewProjectData({...newProjectData, pmId: e.target.value})}><option value="">Kein PM zugewiesen</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div className="pt-4 flex gap-3"><button onClick={() => setIsCreatingProject(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600">Abbrechen</button><button onClick={handleCreateProject} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Projekt anlegen</button></div>
            </div>
          </div>
        </div>
      )}
      {/* Project Edit */}
      {isEditingProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Einstellungen</h2><button onClick={() => setIsEditingProject(false)}><X size={20} className="text-gray-400"/></button></div>
              <div className="space-y-4">
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Status</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.status} onChange={(e) => setEditProjectData({...editProjectData, status: e.target.value})}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                <div className="grid grid-cols-3 gap-4"><div className="col-span-1"><label className="text-xs font-semibold text-gray-500 uppercase">Job Nr.</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.jobNr} onChange={(e) => setEditProjectData({...editProjectData, jobNr: e.target.value})} /></div><div className="col-span-2"><label className="text-xs font-semibold text-gray-500 uppercase">Projekt Titel</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.title} onChange={(e) => setEditProjectData({...editProjectData, title: e.target.value})} /></div></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase">Google Doc Link</label><input type="text" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.google_doc_url} onChange={(e) => setEditProjectData({...editProjectData, google_doc_url: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-semibold text-gray-500 uppercase">Deadline</label><input type="date" className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.deadline} onChange={(e) => setEditProjectData({...editProjectData, deadline: e.target.value})} /></div><div><label className="text-xs font-semibold text-gray-500 uppercase">PM</label><select className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50" value={editProjectData.pmId} onChange={(e) => setEditProjectData({...editProjectData, pmId: e.target.value})}><option value="">Kein PM</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>
                <div className="pt-4 flex gap-3"><button onClick={() => setIsEditingProject(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600">Abbrechen</button><button onClick={handleUpdateProject} className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800">Speichern</button></div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}