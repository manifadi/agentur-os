export interface Client {
    id: string;
    name: string;
    logo_url?: string | null;
    organization_id: string;
    description?: string;
    notes?: string;
    address?: string;
    general_email?: string;
    general_phone?: string;
    website?: string;
    full_name?: string; // NEW
    // address?: string; // Already exists in line 8
    uid_number?: string; // NEW
}

export interface ClientLog {
    id: string;
    client_id: string;
    author_id: string;
    title: string;
    content: string;
    created_at: string;
    organization_id: string;
    employees?: Employee; // Joined author
}

export interface ClientContact {
    id: string;
    client_id: string;
    name: string;
    email?: string;
    phone?: string;
    role?: string;
    organization_id: string;
}

export interface Employee {
    id: string;
    name: string;
    initials: string;
    department_id?: string;
    job_title?: string;
    email?: string;
    role?: 'admin' | 'user';
    organization_id?: string;
    hourly_rate?: number; // [NEW]
    phone?: string; // [NEW]
}

export interface Department {
    id: string;
    name: string;
    organization_id: string;
}

export interface Todo {
    id: string;
    project_id: string;
    organization_id: string;
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
    organization_id: string;
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
    organization_id: string;
    contract_intro?: string; // NEW
    contract_outro?: string; // NEW
    invoice_contact_id?: string | null; // NEW // NEW

    // Joined data
    clients?: Client;
    employees?: Employee;
    invoice_contact?: ClientContact; // Joined
    todos?: Todo[];

    // Computed
    totalTodos?: number;
    doneTodos?: number;
    openTodosPreview?: Todo[];
    sections?: ProjectSection[];
    positions?: ProjectPosition[];
}

export interface ProjectSection {
    id: string;
    project_id: string;
    title: string;
    description?: string;
    order_index: number;
    positions?: ProjectPosition[]; // Joined
}

export interface ProjectPosition {
    id: string;
    project_id: string;
    section_id?: string;
    position_nr?: string;
    title: string;
    description?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    hourly_rate: number; // For PDF
    hours_sold: number; // For PDF
    total_price: number;
    order_index: number;
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
    position_id?: string | null; // [NEW] Link to specific position
    projects?: Project;
    positions?: ProjectPosition; // [NEW] Joined data
    organization_id: string;
}

export interface TimeEntry {
    id: string;
    project_id: string;
    position_id?: string | null;
    agency_position_id?: string | null; // NEW
    employee_id: string;
    date: string;
    hours: number;
    description?: string;
    created_at?: string;
    // Joined
    projects?: Project;
    positions?: ProjectPosition;
}

// Map for grid: Employee -> Allocations[]
export interface AllocationRow {
    employee: Employee;
    allocations: ResourceAllocation[];
}

export interface Organization {
    id: string;
    name: string;
}

export interface RegistrationRequest {
    id: string;
    email: string;
    name: string;
    company_name?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    organization_id?: string;
    organization_name?: string;
}

export type ViewState = 'dashboard' | 'projects_overview' | 'global_tasks' | 'resource_planning' | 'settings';

export interface AgencyPosition {
    id: string;
    title: string;
    hourly_rate: number;
    category?: string;
    organization_id: string;
}

export interface AgencySettings {
    id: string;
    organization_id: string;
    company_name: string;
    address: string;
    website?: string; // NEW
    general_email?: string; // NEW
    general_phone?: string; // NEW
    tax_id: string;
    bank_name: string;
    iban: string;
    bic: string;
    commercial_register: string;
    footer_text: string;
    logo_url: string;
    document_header_url?: string;
    resource_planner_departments?: string[];
}

export interface OrganizationTemplate {
    id: string;
    organization_id: string;
    name: string;
    content: string;
    type: 'intro' | 'outro';
}
