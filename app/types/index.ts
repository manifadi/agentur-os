export interface Client {
    id: string;
    name: string;
    logo_url?: string | null;
}

export interface Employee {
    id: string;
    name: string;
    initials: string;
    department_id?: string;
    email?: string;
    role?: 'admin' | 'user';
}

export interface Department {
    id: string;
    name: string;
}

export interface Todo {
    id: string;
    project_id: string;
    title: string;
    is_done: boolean;
    assigned_to?: string | null;
    employees?: Employee;
    // For global view flattening
    project_title?: string;
    project_status?: string;
    clients?: Client;
    job_number?: string;
    deadline?: string | null;
}

export interface ProjectLog {
    id: string;
    project_id: string;
    title: string;
    content: string;
    image_url?: string | null;
    entry_date: string;
    employee_id?: string | null;
    is_public?: boolean;
    projects?: { title: string };
}

export interface Project {
    id: string;
    created_at: string;
    title: string;
    job_number: string;
    status: string;
    deadline?: string | null;
    client_id: string;
    project_manager_id?: string | null;
    google_doc_url?: string | null;
    offer_pdf_url?: string | null;

    // Joined data
    clients?: Client;
    employees?: Employee;
    todos?: Todo[];

    // Computed
    totalTodos?: number;
    doneTodos?: number;
    openTodosPreview?: Todo[];
}

export interface ResourceAllocation {
    id: string;
    employee_id: string;
    project_id: string;
    year: number;
    week_number: number;
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    comment?: string;
    task_description?: string; // New field
    projects?: Project;
}

// Map for grid: Employee -> Allocations[]
export interface AllocationRow {
    employee: Employee;
    allocations: ResourceAllocation[];
}

export type ViewState = 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'settings';
