export interface CatalogCourse { code: string; title: string }
export interface CatalogProgramme { name: string; semesters: { label: string; courses: CatalogCourse[] }[]; manual?: boolean }

export const IT_SCHOOL = 'Engineering & Technology';
export const IT_DEPARTMENT = 'Information Technology';
export const SESSION_OPTIONS = ['January 2026', 'December 2026'];

const c = (code: string, title: string): CatalogCourse => ({ code, title });
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const sems = (list: CatalogCourse[][]) => list.map((courses, i) => ({ label: ROMAN[i], courses }));

export const IT_PROGRAMMES: CatalogProgramme[] = [
  {
    name: 'B.Tech CSE',
    semesters: sems([
      [c('25MT2U101', 'Discrete Mathematics (MDC)'), c('BT 102', 'Engineering Physics'), c('CHM20-MIN-101', 'General Chemistry'), c('BT 104', 'Engineering Drawing (SEC)'), c('BT 107 L', 'Engineering Physics Lab'), c('CHM20-MIN-102', 'Chemistry Lab'), c('BT111', 'Computer Fundamentals and Applications'), c('BT110', 'VBC-I (Sociology & Elements of Modern Indian History for Engineers)'), c('BAENG-AEC-101', 'AEC-I (Digital Communication)')],
      [c('25MT2U201', 'Linear Algebra & Differential Calculus (MDC)'), c('BT 204', 'Basic Electrical Engineering'), c('BT 205', 'Engineering Mechanics (SEC)'), c('BT 208 L', 'Basic Electrical Engineering Lab'), c('BT 213', 'Computer Programming'), c('BT 214 L', 'Computer Programming Lab'), c('BT 216', 'Engineering Workshop'), c('', 'VBC-II'), c('', 'AEC-II')],
      [c('BT 301', 'Mathematics III (Differential Equation)'), c('BTCS 302', 'Basic Electronics'), c('BTCS 303', 'Data Structures'), c('BTCS 308', 'Database Management Systems'), c('BTCS 305 L', 'Basic Electronics Lab'), c('BTCS 306 L', 'Data Structures Lab'), c('BT 309 L', 'Database Management Systems Lab'), c('BT 307', 'Environmental Studies')],
      [c('BT 401', 'Mathematics IV (Probability and Statistics)'), c('BTCS 408', 'Design and Analysis of Algorithms'), c('BTCS 403', 'Discrete Structures'), c('BTCS 404', 'Digital Electronics & Logic Design'), c('BTCS 406 L', 'Digital Electronics & Logic Design Lab'), c('BT 407', 'Economics for Engineers'), c('BTCS409', 'Object-oriented Programming'), c('BTCS 410', 'OOP Lab')],
      [c('BTCS 501', 'Computer Organisation & Architecture'), c('BTCS 507', 'Computer Graphics'), c('BTCS 508', 'Data Communication'), c('BTCS 509', 'Operating Systems'), c('BTCS 511 L', 'Computer Graphics Lab'), c('BTCS 512', 'Web Design and Development'), c('BTCS 513L', 'Web Design and Development Lab')],
      [c('BTCS 609', 'Software Analysis & Design'), c('BTCS 602', 'Computer Networks'), c('BTCS 604', 'Theory of Computation'), c('BTCS 606 L', 'Computer Networks Lab'), c('BTCS 607', 'Microprocessor'), c('BTCS 608L', 'Microprocessor Lab'), c('BTCS E***', 'Elective 1')],
      [c('BTCS 708', 'Software Engineering'), c('BTCS 703', 'Pre Project/Seminar'), c('BTCS 716', 'Network Security'), c('BTCS 718 L', 'Network Security Lab'), c('BTCS 706', 'Compiler Design'), c('BTCS E***', 'Elective 2'), c('BTCS 707', 'Industrial Training/Internship')],
      [c('BTCS 815', 'Artificial Intelligence'), c('BTCS 802', 'Project'), c('BTCS 803', 'Python Programming'), c('BTCS 804', 'Python Programming Lab'), c('BTCS E***', 'Elective 3')],
    ]),
  },
  {
    name: 'M.Tech CSE',
    semesters: sems([
      [c('TAA.61.501', 'Credit Oriented Software Engineering'), c('TAA.61.502', 'Algorithms & Algorithmic Complexity'), c('TAA.61.503', 'Algorithms & Algorithmic Complexity Lab'), c('TAA.61.504', 'High-Performance Computer Architecture'), c('TAA.61.505', 'High-Performance Computer Architecture Lab'), c('TAA.61.506', 'Ability Enhancement Course-I'), c('', 'Value Added Course-I / Elective')],
      [c('TAA.61.551', 'Next Generation Networks'), c('TAA.61.552', 'Next Generation Networks Lab'), c('TAA.61.553', 'Data Science'), c('TAA.61.554', 'Data Science Lab'), c('', 'Elective / SEC-I / MDC-I'), c('', 'Ability Enhancement Course-II'), c('', 'Value Added Course-II / Elective')],
      [c('TAA.61.601', 'Network Security'), c('TAA.61.602', 'Network Security Lab'), c('TAA.61.603', 'Research Methodology'), c('TAA.61.604', 'Wireless Communication'), c('TAA.61.605', 'Research Project Phase I'), c('', 'Elective II / MDC-II')],
      [c('TAA.68.651', 'Research Project Phase II (Dissertation)'), c('', 'Elective/Experiential Learning')],
    ]),
  },
  {
    name: 'M.Tech AI & ML',
    semesters: sems([
      [c('TAA.61.506', 'Introduction to Artificial Intelligence & Mathematics Foundations for AI & Machine Learning'), c('TAA.61.507', 'Machine Learning (Algebra, Probability, Statistics, Multivariate Calculus)'), c('TAA.61.508', 'Advanced Data Structure and Algorithm'), c('TAA.61.509', 'Computer Systems Software'), c('TAA.61.510', 'Computer Systems Software Lab'), c('TAA.61.511', 'Research Methodology, Ethics and IPR')],
      [c('TAA.61.555', 'Machine Learning'), c('TAA.61.556', 'Computer Vision'), c('TAA.61.557', 'Optimization Techniques'), c('TAA.61.558', 'Natural Language Processing'), c('', 'Elective')],
      [c('TAA.61.606', 'Advanced Deep Learning and Neural Architectures'), c('TAA.61.607', 'Research Seminar'), c('TAA.61.608', 'Research Project Phase I'), c('', 'Elective via various MOOCs courses'), c('', 'Viva Blended Learning'), c('', 'Elective III')],
      [c('TAA.68.651', 'Research Project Phase II (Dissertation)'), c('', 'Elective/Experiential Learning')],
    ]),
  },
  { name: 'PhD', semesters: [], manual: true },
];

export const ROMAN_NUMERALS: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

export const getSemesterNumber = (label: string): number => {
  const clean = label.trim().toUpperCase();
  if (ROMAN_NUMERALS[clean]) return ROMAN_NUMERALS[clean];
  const parsed = parseInt(clean, 10);
  return isNaN(parsed) ? 0 : parsed;
};

export const isSemesterMatchingSession = (semesterLabel: string, sessionLabel: string): boolean => {
  if (!sessionLabel) return true;
  const s = sessionLabel.toLowerCase();
  const num = getSemesterNumber(semesterLabel);
  if (num === 0) return true;
  if (s.includes('jan')) {
    return num % 2 === 0; // Even semesters for January session
  }
  if (s.includes('dec')) {
    return num % 2 !== 0; // Odd semesters for December session
  }
  return true;
};

export interface TeacherPoolItem {
  id?: string;
  email?: string;
  name: string;
  designation: string;
  specialization: string;
  postal_address: string;
  contact_details: string;
  status?: string;
}

export const DEFAULT_TEACHER_POOL: TeacherPoolItem[] = [
  {
    email: 'nazimayousuf60@gmail.com',
    name: 'Nazima Yousuf',
    designation: 'Teaching Assistant',
    specialization: 'Computer Science and Engineering',
    postal_address: 'Central University of kashmir Tulmulla',
    contact_details: '9149945991 / nazimayousuf60@gmail.com',
    status: '',
  },
  {
    email: 'shahid.sultan@cukashmir.ac.in',
    name: 'Dr. Shahid Sultan',
    designation: 'Assistant Professor',
    specialization: 'Resource optimization',
    postal_address: 'Department of Information Technology, Central University of Kashmir, Tulmulla Ganderbal 191131',
    contact_details: '7006687396 / shahid.sultan@cukashmir.ac.in',
    status: '',
  },
  {
    email: 'peermuniba70@gmail.com',
    name: 'Dr. Muneeba Afzal Mukhdoomi',
    designation: 'Guest Faculty',
    specialization: 'Artificial Intelligence, Machine Learning',
    postal_address: 'Sikh bagh, Lal bazaar srinagar',
    contact_details: '9103737100 / peermuniba70@gmail.com',
    status: '',
  },
  {
    email: 'yashpaulcuk@gmail.com',
    name: 'Yash Paul',
    designation: 'Assistant professor',
    specialization: 'AI/ML',
    postal_address: 'V.P.O, BADHOLE, TEH. RAMNAGAR, DISTT. UDHAMPUR, JAMMU AND KASHMIR',
    contact_details: '7006 934 028 / yashpaulcuk@gmail.com',
    status: '',
  },
  {
    email: 'azmijaan@gmail.com',
    name: 'Azrah Rubanee',
    designation: 'Guest faculty',
    specialization: 'MTech in ECE',
    postal_address: 'Rangpora Saloora ganderbal',
    contact_details: '7889450832 / azmijaan@gmail.com',
    status: '',
  },
  {
    email: 'ajaz.maths@gmail.com',
    name: 'AJAZ HUSSAIN RATHER',
    designation: 'Guest faculty',
    specialization: 'Mathematics',
    postal_address: 'Manigam Ganderbal',
    contact_details: '7006710109 / ajaz.maths@gmail.com',
    status: '',
  },
  {
    email: 'afaqalamkhan@cukashmir.ac.in',
    name: 'Afaq Alam Khan',
    designation: 'Assistant Professor',
    specialization: 'Data Science',
    postal_address: 'Department of Information Technology, Central University of Kashmir, Tulmulla, Ganderbal, J&k',
    contact_details: '9469054115 / afaqalamkhan@cukashmir.ac.in',
    status: '',
  },
  {
    email: 'zahoornejar@cukashmir.ac.in',
    name: 'Dr. Zahoor Ahmad Najar',
    designation: 'Sr. Assistant Professor',
    specialization: 'computer networks, Network security',
    postal_address: 'Department of Information Technology Central University of Kashmir Tulla Mulla Ganderbal 191131',
    contact_details: '94195 05159 / zahoornejar@cukashmir.ac.in',
    status: '',
  },
  {
    email: 'khanishrat173@gmail.com',
    name: 'Ishrat Khan',
    designation: 'Assistant professor (Guest Faculty)',
    specialization: 'Artificial Intelligence',
    postal_address: 'Benhama Ganderbal, J&K',
    contact_details: '9149999428 / khanishrat173@gmail.com',
    status: '',
  },
  {
    email: 'shah.faixu123@gmail.com',
    name: 'Shah Faisal',
    designation: 'Guest Faculty',
    specialization: 'Computer Science and Engineering',
    postal_address: 'Department of Information Technology, CUK, Tulmullah',
    contact_details: '9682345443 / shah.faixu123@gmail.com',
    status: '',
  },
  {
    email: 'amjed.husain@gmail.com',
    name: 'Amjad Husain',
    designation: 'Assistant Professor',
    specialization: 'Algorithms and Data structures, Programming, Network Security, Machine Learning.',
    postal_address: 'Department of IT, Tullmulla , Central University of Kashmir',
    contact_details: '9149725792 / amjed.husain@gmail.com',
    status: '',
  },
];

export const courseKey = (code: string | null | undefined, title: string | null | undefined) =>
  `${(code || '').trim()}::${(title || '').trim()}`.toLowerCase();
