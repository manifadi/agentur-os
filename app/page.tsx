'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MoreVertical,
  ChevronRight,
  User,
  ArrowLeft,
  Plus,
  X,
  Save,
  Settings,
  Trash2,
  Edit3,
  Users,
  Upload,
  Image as ImageIcon,
  Pencil,
  Search,
  LogOut,
  Lock,
} from 'lucide-react';
import { supabase } from './supabaseClient';

// --- LOGIN COMPONENT ---
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false); // Toggle zwischen Login & Registrieren
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white">
            <Lock size={24} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-1 text-gray-900">
          Agentur OS
        </h1>
        <p className="text-center text-gray-500 text-sm mb-8">
          Bitte melde dich an
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              required
              className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              Passwort
            </label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full rounded-lg border-gray-200 text-sm py-2.5 px-3 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-gray-900 outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {msg && <div className="text-xs text-red-500 text-center">{msg}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50 transition"
          >
            {loading ? 'Lade...' : isSignUp ? 'Account erstellen' : 'Anmelden'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMsg('');
            }}
            className="text-xs text-gray-400 hover:text-gray-900 transition"
          >
            {isSignUp
              ? 'Zurück zum Login'
              : 'Noch keinen Account? Registrieren'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP ---
const getStatusStyle = (status) => {
  switch (status) {
    case 'In Umsetzung':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Beauftragt':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'Warten auf Kunde':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Warten auf MA':
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'Korrektur':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'Anfrage':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'Abgerechnet':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Archiviert':
      return 'bg-gray-100 text-gray-400 border-gray-200';
    default:
      return 'bg-gray-50 text-gray-600 border-gray-100';
  }
};

const STATUS_OPTIONS = [
  'Anfrage',
  'Angebot offen',
  'Beauftragt',
  'In Umsetzung',
  'Korrektur',
  'Warten auf Kunde',
  'Warten auf MA',
  'Abgerechnet',
  'Archiviert',
];

export default function AgenturDashboard() {
  // --- SESSION STATE ---
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // --- DATA STATE ---
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false); // Loading Data

  // --- UI STATE ---
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTodos, setProjectTodos] = useState([]);
  const [projectLogs, setProjectLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('Alle');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);

  // --- INPUT STATES ---
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoAssignee, setNewTodoAssignee] = useState('');

  const [isAddingLog, setIsAddingLog] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogContent, setNewLogContent] = useState('');

  // --- EDIT STATES ---
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editTodoTitle, setEditTodoTitle] = useState('');
  const [editTodoAssignee, setEditTodoAssignee] = useState('');

  const [editingLogId, setEditingLogId] = useState(null);
  const [editLogTitle, setEditLogTitle] = useState('');
  const [editLogContent, setEditLogContent] = useState('');

  // --- MODAL STATES ---
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isEditingProject, setIsEditingProject] = useState(false);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [clientFormName, setClientFormName] = useState('');
  const [clientFormLogo, setClientFormLogo] = useState(null);

  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeFormName, setEmployeeFormName] = useState('');

  const [newProjectData, setNewProjectData] = useState({
    title: '',
    jobNr: '',
    clientId: '',
    pmId: '',
    deadline: '',
  });
  const [editProjectData, setEditProjectData] = useState({
    id: '',
    title: '',
    status: '',
    deadline: '',
    google_doc_url: '',
    pmId: '',
  });

  // Refs
  const logoInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // 1. AUTH CHECK ON LOAD
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. DATA LOAD (Only if session exists)
  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  // 3. PROJECT DETAILS LOAD
  useEffect(() => {
    if (selectedProject) {
      fetchProjectDetails(selectedProject.id);
      setIsAddingTodo(false);
      setIsAddingLog(false);
      setEditingLogId(null);
      setEditingTodoId(null);
      // ÄNDERUNG: Standardmäßig KEIN Assignee (leer), vorher war es PM
      setNewTodoAssignee('');
    }
  }, [selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (c) setClients(c);
    const { data: e } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    if (e) setEmployees(e);
    const { data: p } = await supabase
      .from('projects')
      .select(`*, employees ( id, name, initials ), clients ( name, logo_url )`)
      .order('created_at', { ascending: false });
    if (p) setProjects(p);
    setLoading(false);
  };

  const fetchProjectDetails = async (projectId) => {
    const { data: t } = await supabase
      .from('todos')
      .select(`*, employees ( id, initials, name )`)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });
    if (t) setProjectTodos(t);
    const { data: l } = await supabase
      .from('project_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false });
    if (l) setProjectLogs(l);
  };

  // --- HELPER: LOGOUT ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProjects([]); // Clear sensitive data from UI
  };

  // --- HELPER: FILE OPS ---
  const deleteFileFromSupabase = async (fullUrl, bucket) => {
    if (!fullUrl) return;
    try {
      const fileName = fullUrl.split('/').pop();
      if (fileName) await supabase.storage.from(bucket).remove([fileName]);
    } catch (e) {
      console.warn(e);
    }
  };
  const uploadFileToSupabase = async (file, bucket) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  };

  // --- HANDLERS: CLIENT ---
  const openClientModal = (client = null) => {
    setEditingClient(client);
    setClientFormName(client ? client.name : '');
    setClientFormLogo(null);
    setClientModalOpen(true);
  };
  const handleSaveClient = async () => {
    if (!clientFormName.trim()) return;
    setUploading(true);
    let logoUrl = editingClient?.logo_url || null;
    if (clientFormLogo) {
      try {
        if (editingClient?.logo_url)
          await deleteFileFromSupabase(editingClient.logo_url, 'logos');
        logoUrl = await uploadFileToSupabase(clientFormLogo, 'logos');
      } catch (e) {
        alert('Fehler beim Logo Upload: ' + e.message);
        setUploading(false);
        return;
      }
    }
    if (editingClient) {
      const { data } = await supabase
        .from('clients')
        .update({ name: clientFormName, logo_url: logoUrl })
        .eq('id', editingClient.id)
        .select();
      if (data)
        setClients(clients.map((c) => (c.id === data[0].id ? data[0] : c)));
    } else {
      const { data } = await supabase
        .from('clients')
        .insert([{ name: clientFormName, logo_url: logoUrl }])
        .select();
      if (data)
        setClients(
          [...clients, data[0]].sort((a, b) => a.name.localeCompare(b.name))
        );
    }
    setUploading(false);
    setClientModalOpen(false);
  };
  const handleDeleteClient = async (id) => {
    if (!confirm('Kunden wirklich löschen?')) return;
    await supabase.from('clients').delete().eq('id', id);
    setClients(clients.filter((c) => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
  };

  // --- HANDLERS: EMPLOYEE ---
  const openEmployeeModal = (emp = null) => {
    setEditingEmployee(emp);
    setEmployeeFormName(emp ? emp.name : '');
    setEmployeeModalOpen(true);
  };
  const handleSaveEmployee = async () => {
    if (!employeeFormName.trim()) return;
    const initials = employeeFormName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    if (editingEmployee) {
      const { data } = await supabase
        .from('employees')
        .update({ name: employeeFormName, initials })
        .eq('id', editingEmployee.id)
        .select();
      if (data)
        setEmployees(employees.map((e) => (e.id === data[0].id ? data[0] : e)));
    } else {
      const { data } = await supabase
        .from('employees')
        .insert([{ name: employeeFormName, initials }])
        .select();
      if (data) setEmployees([...employees, data[0]]);
    }
    setEmployeeModalOpen(false);
  };
  const handleDeleteEmployee = async (id) => {
    if (!confirm('Mitarbeiter löschen?')) return;
    await supabase.from('employees').delete().eq('id', id);
    setEmployees(employees.filter((e) => e.id !== id));
  };

  // --- HANDLERS: PDF UPLOAD ---
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedProject) return;
    setUploading(true);
    try {
      if (selectedProject.offer_pdf_url)
        await deleteFileFromSupabase(
          selectedProject.offer_pdf_url,
          'documents'
        );
      const url = await uploadFileToSupabase(file, 'documents');
      const { data } = await supabase
        .from('projects')
        .update({ offer_pdf_url: url })
        .eq('id', selectedProject.id)
        .select(
          `*, employees ( id, name, initials ), clients ( name, logo_url )`
        );
      if (data) {
        setSelectedProject(data[0]);
        setProjects((prev) =>
          prev.map((p) => (p.id === data[0].id ? data[0] : p))
        );
      }
    } catch (error) {
      console.error(error);
      alert('Fehler beim Upload.');
    }
    setUploading(false);
  };

  // --- HANDLERS: PROJECT ---
  const handleCreateProject = async () => {
    if (
      !newProjectData.title ||
      !newProjectData.jobNr ||
      !newProjectData.clientId
    ) {
      alert('Pflichtfelder fehlen.');
      return;
    }
    const { data } = await supabase
      .from('projects')
      .insert([
        {
          title: newProjectData.title,
          job_number: newProjectData.jobNr,
          client_id: newProjectData.clientId,
          project_manager_id: newProjectData.pmId || null,
          deadline: newProjectData.deadline || null,
          status: 'Anfrage',
        },
      ])
      .select();
    if (data) {
      fetchData();
      setIsCreatingProject(false);
      setNewProjectData({
        title: '',
        jobNr: '',
        clientId: '',
        pmId: '',
        deadline: '',
      });
    }
  };
  const handleUpdateProject = async () => {
    const { data } = await supabase
      .from('projects')
      .update({
        title: editProjectData.title,
        status: editProjectData.status,
        deadline: editProjectData.deadline || null,
        google_doc_url: editProjectData.google_doc_url,
        project_manager_id: editProjectData.pmId || null,
      })
      .eq('id', editProjectData.id)
      .select(
        `*, employees ( id, name, initials ), clients ( name, logo_url )`
      );
    if (data) {
      setProjects((prev) =>
        prev.map((p) => (p.id === data[0].id ? data[0] : p))
      );
      setSelectedProject(data[0]);
      setIsEditingProject(false);
    }
  };
  const handleDeleteProject = async () => {
    if (!confirm('Wirklich löschen?')) return;
    await supabase.from('projects').delete().eq('id', selectedProject.id);
    setProjects((prev) => prev.filter((p) => p.id !== selectedProject.id));
    setSelectedProject(null);
  };

  // --- HANDLERS: TODO ---
  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) return;
    const assignedTo = newTodoAssignee || null;
    const { data } = await supabase
      .from('todos')
      .insert([
        {
          project_id: selectedProject.id,
          title: newTodoTitle,
          assigned_to: assignedTo,
        },
      ])
      .select(`*, employees ( id, initials, name )`);
    if (data) {
      setProjectTodos([...projectTodos, data[0]]);
      setNewTodoTitle('');
      setNewTodoAssignee(''); // Reset to empty
      setIsAddingTodo(false);
    }
  };
  const toggleTodo = async (todoId, currentStatus) => {
    setProjectTodos((prev) =>
      prev.map((t) => (t.id === todoId ? { ...t, is_done: !currentStatus } : t))
    );
    await supabase
      .from('todos')
      .update({ is_done: !currentStatus })
      .eq('id', todoId);
  };
  const startEditingTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditTodoTitle(todo.title);
    setEditTodoAssignee(todo.assigned_to || '');
  };
  const cancelEditingTodo = () => {
    setEditingTodoId(null);
    setEditTodoTitle('');
    setEditTodoAssignee('');
  };
  const handleUpdateTodo = async (todoId) => {
    if (!editTodoTitle.trim()) return;
    const { data } = await supabase
      .from('todos')
      .update({ title: editTodoTitle, assigned_to: editTodoAssignee || null })
      .eq('id', todoId)
      .select(`*, employees ( id, initials, name )`);
    if (data) {
      setProjectTodos((prev) =>
        prev.map((t) => (t.id === todoId ? data[0] : t))
      );
      cancelEditingTodo();
    }
  };
  const handleDeleteTodo = async (todoId) => {
    if (!confirm('Aufgabe löschen?')) return;
    await supabase.from('todos').delete().eq('id', todoId);
    setProjectTodos((prev) => prev.filter((t) => t.id !== todoId));
  };

  // --- HANDLERS: LOG ---
  const handleAddLog = async () => {
    if (!newLogTitle.trim()) return;
    const { data } = await supabase
      .from('project_logs')
      .insert([
        {
          project_id: selectedProject.id,
          title: newLogTitle,
          content: newLogContent,
          entry_date: new Date().toISOString(),
        },
      ])
      .select();
    if (data) {
      setProjectLogs([data[0], ...projectLogs]);
      setNewLogTitle('');
      setNewLogContent('');
      setIsAddingLog(false);
    }
  };
  const startEditingLog = (log) => {
    setEditingLogId(log.id);
    setEditLogTitle(log.title);
    setEditLogContent(log.content);
  };
  const cancelEditingLog = () => {
    setEditingLogId(null);
    setEditLogTitle('');
    setEditLogContent('');
  };
  const handleUpdateLog = async (logId) => {
    if (!editLogTitle.trim()) return;
    const { data } = await supabase
      .from('project_logs')
      .update({ title: editLogTitle, content: editLogContent })
      .eq('id', logId)
      .select();
    if (data) {
      setProjectLogs((prev) => prev.map((l) => (l.id === logId ? data[0] : l)));
      cancelEditingLog();
    }
  };
  const handleDeleteLog = async (logId) => {
    if (!confirm('Eintrag löschen?')) return;
    await supabase.from('project_logs').delete().eq('id', logId);
    setProjectLogs((prev) => prev.filter((l) => l.id !== logId));
  };
  const openEditModal = () => {
    setEditProjectData({
      id: selectedProject.id,
      title: selectedProject.title,
      status: selectedProject.status,
      deadline: selectedProject.deadline || '',
      google_doc_url: selectedProject.google_doc_url || '',
      pmId: selectedProject.project_manager_id || '',
    });
    setIsEditingProject(true);
  };

  // --- FILTER LOGIC ---
  const filteredProjects = projects.filter((p) => {
    if (selectedClient && p.client_id !== selectedClient.id) return false;
    if (statusFilter !== 'Alle' && p.status !== statusFilter) return false;
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      const matchesTitle = p.title?.toLowerCase().includes(lowerTerm);
      const matchesJobNr = p.job_number?.toLowerCase().includes(lowerTerm);
      const matchesClient = p.clients?.name?.toLowerCase().includes(lowerTerm);
      return matchesTitle || matchesJobNr || matchesClient;
    }
    return true;
  });

  // --- RENDER LOADING / LOGIN / DASHBOARD ---
  if (loadingSession)
    return (
      <div className="flex h-screen items-center justify-center text-gray-400 font-medium">
        Lade App...
      </div>
    );

  if (!session) {
    return <LoginScreen />;
  }

  return (
    <div className="flex min-h-screen bg-[#F9FAFB] text-gray-900 font-sans relative">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen overflow-y-auto z-10">
        <div className="p-6 flex-1 flex flex-col h-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Kunden
            </h2>
            <button
              onClick={() => openClientModal(null)}
              className="text-gray-400 hover:text-gray-900 transition"
            >
              <Plus size={14} />
            </button>
          </div>
          <nav className="space-y-1 mb-8">
            <button
              onClick={() => setSelectedClient(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                !selectedClient
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Alle Kunden
            </button>
            {clients.map((client) => (
              <div
                key={client.id}
                className="group flex items-center pr-2 rounded-lg transition hover:bg-gray-50"
              >
                <button
                  onClick={() => setSelectedClient(client)}
                  className={`flex-1 text-left px-3 py-2 text-sm font-medium flex items-center gap-3 ${
                    selectedClient?.id === client.id
                      ? 'bg-gray-100 text-gray-900 rounded-lg'
                      : 'text-gray-600'
                  }`}
                >
                  {client.logo_url ? (
                    <img
                      src={client.logo_url}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center text-[6px] text-white">
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  {client.name}
                </button>
                <button
                  onClick={() => openClientModal(client)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600"
                >
                  <Settings size={12} />
                </button>
              </div>
            ))}
          </nav>

          <div className="flex justify-between items-center mb-4 mt-4 pt-6 border-t border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Team
            </h2>
            <button
              onClick={() => openEmployeeModal(null)}
              className="text-gray-400 hover:text-gray-900 transition"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="space-y-2 mb-auto">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="group flex justify-between items-center px-3 py-1 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-[10px] text-white">
                    {emp.initials}
                  </div>
                  <span className="text-sm text-gray-600">{emp.name}</span>
                </div>
                <button
                  onClick={() => openEmployeeModal(emp)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-gray-600"
                >
                  <Pencil size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* LOGOUT BUTTON UNTEN */}
          <div className="pt-6 border-t border-gray-100 mt-6">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 w-full px-2 py-2 rounded transition hover:bg-red-50"
            >
              <LogOut size={16} /> Abmelden
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8">
        {selectedProject ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => setSelectedProject(null)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={16} className="mr-1" /> Zurück zur Übersicht
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteProject}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={openEditModal}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition"
                >
                  <Settings size={16} /> Einstellungen
                </button>
              </div>
            </div>

            <div className="flex justify-between items-start mb-8">
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {selectedProject.job_number}
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">
                  {selectedProject.title}
                </h1>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(
                    selectedProject.status
                  )}`}
                >
                  {selectedProject.status}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">Projektmanager</div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-sm font-medium">
                    {selectedProject.employees?.name || 'Nicht zugewiesen'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-xs text-white">
                    {selectedProject.employees?.initials || '--'}
                  </div>
                </div>
                <div className="mt-2 text-xs text-red-500 font-medium">
                  Deadline: {selectedProject.deadline || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[600px]">
              {/* PDF BOX */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText size={20} className="text-gray-400" />{' '}
                  Projektdetails
                </h2>
                <div className="flex-1 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 relative overflow-hidden group">
                  {uploading ? (
                    <div className="animate-pulse text-sm">
                      Lade Datei hoch...
                    </div>
                  ) : selectedProject.offer_pdf_url ? (
                    <>
                      <FileText size={48} className="mb-2 text-gray-800" />
                      <span className="text-sm font-medium text-gray-900 mb-4">
                        Angebot hinterlegt
                      </span>
                      <div className="flex gap-2">
                        <a
                          href={selectedProject.offer_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm hover:bg-gray-100"
                        >
                          Öffnen
                        </a>
                        <button
                          onClick={() => pdfInputRef.current?.click()}
                          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm hover:bg-gray-100"
                        >
                          Ändern
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="mb-2 opacity-20" />
                      <span className="text-sm mb-2">Kein Angebot PDF</span>
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        PDF hochladen
                      </button>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={pdfInputRef}
                    className="hidden"
                    onChange={handlePdfUpload}
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {selectedProject.google_doc_url ? (
                    <a
                      href={selectedProject.google_doc_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full text-blue-600 bg-blue-50 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
                    >
                      Google Doc öffnen ↗
                    </a>
                  ) : (
                    <div className="text-center text-sm text-gray-400">
                      Kein Google Doc verknüpft
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COL */}
              <div className="flex flex-col gap-6 h-full">
                {/* AUFGABEN */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-gray-400" />{' '}
                    Aufgaben
                  </h2>
                  <div className="overflow-y-auto pr-2 space-y-3 flex-1">
                    {projectTodos.map((todo) => (
                      <div
                        key={todo.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 group transition"
                      >
                        {editingTodoId === todo.id ? (
                          <div className="flex flex-1 items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              className="flex-1 bg-gray-50 rounded border-none text-sm px-2 py-1 focus:ring-1 focus:ring-blue-500"
                              value={editTodoTitle}
                              onChange={(e) => setEditTodoTitle(e.target.value)}
                            />
                            <select
                              className="w-24 bg-gray-50 rounded border-none text-xs px-2 py-1 focus:ring-1 focus:ring-blue-500"
                              value={editTodoAssignee}
                              onChange={(e) =>
                                setEditTodoAssignee(e.target.value)
                              }
                            >
                              <option value="">Niemand</option>
                              {employees.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.name}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleUpdateTodo(todo.id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={cancelEditingTodo}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  toggleTodo(todo.id, todo.is_done)
                                }
                                className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                  todo.is_done
                                    ? 'bg-blue-500 border-blue-500'
                                    : 'border-gray-300 hover:border-blue-400'
                                }`}
                              >
                                {todo.is_done && (
                                  <CheckCircle2
                                    size={12}
                                    className="text-white"
                                  />
                                )}
                              </button>
                              <span
                                className={`text-sm transition-all ${
                                  todo.is_done
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-700'
                                }`}
                              >
                                {todo.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {todo.employees && (
                                <div
                                  className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold"
                                  title={todo.employees.name}
                                >
                                  {todo.employees.initials}
                                </div>
                              )}
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                <button
                                  onClick={() => startEditingTodo(todo)}
                                  className="p-1 text-gray-300 hover:text-blue-500"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => handleDeleteTodo(todo.id)}
                                  className="p-1 text-gray-300 hover:text-red-500"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {isAddingTodo ? (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg animate-in fade-in slide-in-from-top-1">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Aufgabe..."
                          className="flex-1 bg-transparent border-none text-sm focus:ring-0 p-1"
                          value={newTodoTitle}
                          onChange={(e) => setNewTodoTitle(e.target.value)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleAddTodo()
                          }
                        />
                        <select
                          className="w-24 bg-transparent border-none text-xs text-gray-500 focus:ring-0 cursor-pointer"
                          value={newTodoAssignee}
                          onChange={(e) => setNewTodoAssignee(e.target.value)}
                        >
                          <option value="">Niemand</option>
                          {employees.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddTodo}
                          className="text-blue-600 hover:bg-blue-100 p-1 rounded"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => setIsAddingTodo(false)}
                          className="text-gray-400 hover:bg-gray-200 p-1 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsAddingTodo(true)}
                        className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 mt-4 pl-1 transition"
                      >
                        <Plus size={14} /> Neue Aufgabe
                      </button>
                    )}
                  </div>
                </div>

                {/* LOGBUCH */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-gray-400" /> Logbuch
                  </h2>
                  {isAddingLog && (
                    <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <input
                        type="text"
                        placeholder="Titel"
                        className="w-full bg-transparent border-none text-sm font-semibold mb-2 focus:ring-0 p-0"
                        value={newLogTitle}
                        onChange={(e) => setNewLogTitle(e.target.value)}
                      />
                      <textarea
                        placeholder="Notiz..."
                        className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-16"
                        value={newLogContent}
                        onChange={(e) => setNewLogContent(e.target.value)}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => setIsAddingLog(false)}
                          className="text-xs text-gray-500 px-3 py-1 hover:bg-gray-200 rounded-md"
                        >
                          Abbrechen
                        </button>
                        <button
                          onClick={handleAddLog}
                          className="text-xs bg-gray-900 text-white px-3 py-1 rounded-md shadow-sm"
                        >
                          Speichern
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-y-auto pr-2 space-y-6 flex-1 relative">
                    <div className="absolute left-[7px] top-2 bottom-0 w-[1px] bg-gray-100"></div>
                    {!isAddingLog && (
                      <button
                        onClick={() => setIsAddingLog(true)}
                        className="relative ml-6 mb-4 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition"
                      >
                        <Plus size={14} /> Eintrag hinzufügen
                      </button>
                    )}

                    {projectLogs.map((log) => (
                      <div key={log.id} className="relative pl-6 pb-2 group">
                        <div className="absolute left-0 top-1.5 w-3.5 h-3.5 bg-gray-200 rounded-full border-2 border-white"></div>
                        {editingLogId === log.id ? (
                          <div className="bg-gray-50 p-3 rounded-xl border border-blue-200 -ml-2">
                            <input
                              autoFocus
                              type="text"
                              className="w-full bg-transparent border-none text-sm font-semibold mb-1 focus:ring-0 p-0"
                              value={editLogTitle}
                              onChange={(e) => setEditLogTitle(e.target.value)}
                            />
                            <textarea
                              className="w-full bg-transparent border-none text-sm text-gray-600 resize-none focus:ring-0 p-0 h-16"
                              value={editLogContent}
                              onChange={(e) =>
                                setEditLogContent(e.target.value)
                              }
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={cancelEditingLog}
                                className="text-xs text-gray-500 hover:text-gray-700"
                              >
                                Abbrechen
                              </button>
                              <button
                                onClick={() => handleUpdateLog(log.id)}
                                className="text-xs bg-gray-900 text-white px-3 py-1 rounded shadow-sm"
                              >
                                Update
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="pr-4 relative">
                            <div className="text-xs font-bold text-gray-500 mb-0.5">
                              {new Date(log.entry_date).toLocaleDateString(
                                'de-DE',
                                { day: 'numeric', month: 'short' }
                              )}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {log.title}
                            </div>
                            <p className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-wrap">
                              {log.content}
                            </p>
                            <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white pl-2">
                              <button
                                onClick={() => startEditingLog(log)}
                                className="text-gray-400 hover:text-blue-600"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <header className="flex justify-between items-center mb-8 gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight mb-1">
                  {selectedClient ? selectedClient.name : 'Alle Projekte'}
                </h1>
                <p className="text-gray-500 text-sm">
                  Übersicht aller laufenden Jobs
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    className="pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none w-64 transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setIsCreatingProject(true)}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg hover:bg-gray-800 transition flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus size={16} /> Neues Projekt
                </button>
              </div>
            </header>

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              {[
                'Alle',
                'Anfrage',
                'Angebot offen',
                'Beauftragt',
                'In Umsetzung',
                'Warten auf Kunde',
                'Abgerechnet',
                'Archiviert',
              ].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap ${
                    statusFilter === filter
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                      Job Nr
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Projekt Titel
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      PM
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">
                      Deadline
                    </th>
                    <th className="py-3 px-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProjects.map((project) => (
                    <tr
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className="hover:bg-gray-50 cursor-pointer transition group"
                    >
                      <td className="py-3 px-4 text-sm text-gray-500 font-mono">
                        {project.job_number}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 flex items-center gap-2">
                        {!selectedClient && project.clients?.logo_url && (
                          <img
                            src={project.clients.logo_url}
                            className="w-4 h-4 rounded-full"
                          />
                        )}
                        {project.title}
                      </td>
                      <td className="py-3 px-4">
                        <div
                          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] text-gray-600 font-bold"
                          title={project.employees?.name}
                        >
                          {project.employees?.initials || '-'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getStatusStyle(
                            project.status
                          )}`}
                        >
                          {project.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 text-right">
                        {project.deadline}
                      </td>
                      <td className="py-3 px-4 text-gray-400 group-hover:text-gray-600">
                        <ChevronRight size={16} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProjects.length === 0 && (
                <div className="p-12 text-center text-gray-400 text-sm">
                  Keine Projekte gefunden.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* MODALS SECTION */}
      {clientModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {editingClient ? 'Kunde bearbeiten' : 'Neuer Kunde'}
              </h2>
              <button onClick={() => setClientModalOpen(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Firmenname
                </label>
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50 mt-1"
                  value={clientFormName}
                  onChange={(e) => setClientFormName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">
                  Logo (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg flex items-center gap-2 text-gray-600"
                  >
                    <ImageIcon size={14} />{' '}
                    {clientFormLogo ? 'Datei gewählt' : 'Logo wählen'}
                  </button>
                  {editingClient?.logo_url && !clientFormLogo && (
                    <span className="text-xs text-green-600">
                      Aktuelles Logo vorhanden
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  ref={logoInputRef}
                  className="hidden"
                  onChange={(e) => setClientFormLogo(e.target.files[0])}
                />
              </div>
              <div className="pt-2 flex gap-3">
                {editingClient && (
                  <button
                    onClick={() => {
                      handleDeleteClient(editingClient.id);
                      setClientModalOpen(false);
                    }}
                    className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={handleSaveClient}
                  disabled={uploading}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg disabled:opacity-50"
                >
                  {uploading ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {employeeModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">
                {editingEmployee
                  ? 'Mitarbeiter bearbeiten'
                  : 'Neuer Mitarbeiter'}
              </h2>
              <button onClick={() => setEmployeeModalOpen(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Name
                </label>
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50 mt-1"
                  value={employeeFormName}
                  onChange={(e) => setEmployeeFormName(e.target.value)}
                />
              </div>
              <div className="pt-2 flex gap-3">
                {editingEmployee && (
                  <button
                    onClick={() => {
                      handleDeleteEmployee(editingEmployee.id);
                      setEmployeeModalOpen(false);
                    }}
                    className="p-2.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={handleSaveEmployee}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 shadow-lg"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Neues Projekt anlegen</h2>
              <button onClick={() => setIsCreatingProject(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Kunde
                </label>
                <select
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                  value={newProjectData.clientId}
                  onChange={(e) =>
                    setNewProjectData({
                      ...newProjectData,
                      clientId: e.target.value,
                    })
                  }
                >
                  <option value="">Bitte wählen...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Job Nr.
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                    value={newProjectData.jobNr}
                    onChange={(e) =>
                      setNewProjectData({
                        ...newProjectData,
                        jobNr: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Projekt Titel
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                    value={newProjectData.title}
                    onChange={(e) =>
                      setNewProjectData({
                        ...newProjectData,
                        title: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Projektmanager
                </label>
                <select
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                  value={newProjectData.pmId}
                  onChange={(e) =>
                    setNewProjectData({
                      ...newProjectData,
                      pmId: e.target.value,
                    })
                  }
                >
                  <option value="">Kein PM zugewiesen</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsCreatingProject(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateProject}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
                >
                  Projekt anlegen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Einstellungen</h2>
              <button onClick={() => setIsEditingProject(false)}>
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Status
                </label>
                <select
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                  value={editProjectData.status}
                  onChange={(e) =>
                    setEditProjectData({
                      ...editProjectData,
                      status: e.target.value,
                    })
                  }
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">
                  Google Doc Link
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                  value={editProjectData.google_doc_url}
                  onChange={(e) =>
                    setEditProjectData({
                      ...editProjectData,
                      google_doc_url: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Deadline
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                    value={editProjectData.deadline}
                    onChange={(e) =>
                      setEditProjectData({
                        ...editProjectData,
                        deadline: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    PM
                  </label>
                  <select
                    className="w-full rounded-lg border-gray-200 text-sm py-2 px-3 bg-gray-50"
                    value={editProjectData.pmId}
                    onChange={(e) =>
                      setEditProjectData({
                        ...editProjectData,
                        pmId: e.target.value,
                      })
                    }
                  >
                    <option value="">Kein PM</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setIsEditingProject(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleUpdateProject}
                  className="flex-1 py-2.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
                >
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
