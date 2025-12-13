export interface ProfessorCase {
    id: string;
    professor_id: string;
    case_id: string;
    created_at: string;
    updated_at: string;
}

export interface ProfessorStudent {
    id: string;
    professor_id: string;
    student_id: string;
    created_at: string;
}

export interface StudentProfile {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
}
