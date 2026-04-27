import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ChevronDown, Eye, GraduationCap, ListChecks, ListVideo, Pencil, PlusCircle, Trash2, UserPlus } from 'lucide-react';
import { AdminListPagination } from '../components/admin/AdminListPagination';
import { AdminDataTable, adminBodyRowSx, adminHeaderCellSx } from '../components/admin/AdminDataTable';
import { AdminSectionCard } from '../components/admin/AdminSectionCard';
import { AdminShell } from '../components/admin/AdminShell';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { apiFetch } from '../lib/api';
import { newQuizFormRow as newQuizQuestion, quizFormRowsFromApi, buildQuizPayloadFromFormRows } from '../lib/classQuizForm.js';
import { newLectureBlock, blocksFromLectureForForm, countLectureBlocks, normalizeBlocksForApi } from '../lib/lectureBlocksForm.js';
import { AdminLectureBlocksEditor } from '../components/admin/AdminLectureBlocksEditor.jsx';
import { DASH_ADMIN, COMMON, ERR, DASH_TEACHER, TEAM_PAGE, TESTI_PAGE, CONTACT_PAGE } from '../strings/vi';

function toLocalYMD(iso) {
  const x = new Date(iso);
  if (Number.isNaN(x.getTime())) return null;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function lastNLocalDayKeys(n) {
  const keys = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(base);
    dt.setDate(dt.getDate() - i);
    keys.push(
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

/** @param {Array<{ role_title?: string | null, created_at?: string }>} members */
function buildTeamCmsAnalytics(members, unlabeledLabel) {
  const list = Array.isArray(members) ? members : [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  const roleCount = new Map();
  for (const m of list) {
    const ymd = m.created_at ? toLocalYMD(m.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
    const raw = m.role_title != null ? String(m.role_title).trim() : '';
    const key = raw || unlabeledLabel;
    roleCount.set(key, (roleCount.get(key) || 0) + 1);
  }
  const byRole = [...roleCount.entries()]
    .map(([name, count]) => ({
      name: name.length > 22 ? `${name.slice(0, 20)}…` : name,
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const byDaySeries = dayKeys.map((k) => {
    const [, mo, d] = k.split('-');
    return { day: `${d}/${mo}`, count: byDay[k] };
  });
  const newIn30d = dayKeys.reduce((s, k) => s + byDay[k], 0);
  return {
    total: list.length,
    roleKinds: byRole.length,
    newIn30d,
    byRole,
    byDaySeries,
  };
}

/** @param {Array<{ rating?: number | null, created_at?: string }>} items */
function buildTestiCmsAnalytics(items) {
  const list = Array.isArray(items) ? items : [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  const ratingBins = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sumRating = 0;
  let nRated = 0;
  for (const t of list) {
    const ymd = t.created_at ? toLocalYMD(t.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
    const r = t.rating;
    if (r != null && r >= 1 && r <= 5) {
      ratingBins[r] += 1;
      sumRating += r;
      nRated += 1;
    }
  }
  const byDaySeries = dayKeys.map((k) => {
    const [, mo, d] = k.split('-');
    return { day: `${d}/${mo}`, count: byDay[k] };
  });
  const byRatingStars = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: ratingBins[stars] }));
  const newIn30d = dayKeys.reduce((s, k) => s + byDay[k], 0);
  return {
    total: list.length,
    nRated,
    avgRating: nRated > 0 ? Math.round((sumRating / nRated) * 10) / 10 : null,
    newIn30d,
    byRatingStars,
    byDaySeries,
  };
}

/** Dựa trên danh sách tải về (tối đa 200 bản) — cùng dữ liệu bảng. */
function buildContactCmsAnalytics(rows, withSubjectLabel, noSubjectLabel) {
  const list = Array.isArray(rows) ? rows : [];
  const dayKeys = lastNLocalDayKeys(30);
  const byDay = Object.fromEntries(dayKeys.map((k) => [k, 0]));
  let withSubject = 0;
  let withoutSubject = 0;
  for (const r of list) {
    const ymd = r.created_at ? toLocalYMD(r.created_at) : null;
    if (ymd && Object.prototype.hasOwnProperty.call(byDay, ymd)) {
      byDay[ymd] += 1;
    }
    const has = r.subject != null && String(r.subject).trim() !== '';
    if (has) withSubject += 1;
    else withoutSubject += 1;
  }
  const byDaySeries = dayKeys.map((k) => {
    const [, mo, d] = k.split('-');
    return { day: `${d}/${mo}`, count: byDay[k] };
  });
  const newIn30d = dayKeys.reduce((s, k) => s + byDay[k], 0);
  return {
    total: list.length,
    withSubject,
    withoutSubject,
    newIn30d,
    bySubjectKind: [
      { name: withSubjectLabel, count: withSubject },
      { name: noSubjectLabel, count: withoutSubject },
    ],
    byDaySeries,
  };
}

const INITIAL_USER_FORM = { email: '', password: '', full_name: '', role: 'student' };

const INITIAL_COURSE_FORM = {
  title: '',
  description: '',
  thumbnail_url: '/img/course-1.png',
  category_id: '',
  published: true,
  duration_hours: '',
  level: DASH_ADMIN.LEVEL_DEFAULT,
  rating: '',
  learners_count: '',
};

/** Must match `TAB_KEYS` in `AdminShell.jsx` */
const ADMIN_TAB_KEYS = ['users', 'classes', 'courses', 'content'];

export function DashboardAdmin() {
  const theme = useTheme();
  const chartPrimary = theme.palette.primary.main;
  const chartSecondary = theme.palette.secondary.main;
  const chartAccent = theme.palette.info.main;

  const { session, user } = useAuth();
  const token = session?.access_token;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const t = searchParams.get('tab');
    if (t === 'enrollments' || t === 'quiz_stats') return 'courses';
    if (t && ADMIN_TAB_KEYS.includes(t)) return t;
    return 'users';
  }, [searchParams]);
  const courseArea = useMemo(() => {
    const t = searchParams.get('tab');
    if (t === 'enrollments' || t === 'quiz_stats') return t;
    const a = searchParams.get('courseArea');
    if (a === 'enrollments' || a === 'quiz_stats') return a;
    return 'overview';
  }, [searchParams]);
  const setTab = useCallback(
    (v) => {
      if (!ADMIN_TAB_KEYS.includes(v)) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('courseArea');
          if (v === 'users') {
            next.delete('tab');
          } else {
            next.set('tab', v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setCourseArea = useCallback(
    (area) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', 'courses');
          if (area === 'overview') {
            next.delete('courseArea');
          } else {
            next.set('courseArea', area);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t !== 'enrollments' && t !== 'quiz_stats') return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'courses');
        next.set('courseArea', t);
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);
  const [courseMainPanel, setCourseMainPanel] = useState('catalog');

  const [users, setUsers] = useState([]);
  const [userPage, setUserPage] = useState(0);
  const [userPageSize, setUserPageSize] = useState(15);
  const [userTotal, setUserTotal] = useState(0);
  const [userMetrics, setUserMetrics] = useState(null);

  const [categories, setCategories] = useState([]);

  const [courseOptions, setCourseOptions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursePage, setCoursePage] = useState(0);
  const [coursePageSize, setCoursePageSize] = useState(12);
  const [courseTotal, setCourseTotal] = useState(0);

  const [lecturePage, setLecturePage] = useState(0);
  const [lecturePageSize, setLecturePageSize] = useState(20);
  const [lectureTotal, setLectureTotal] = useState(0);
  const [quizListPage, setQuizListPage] = useState(0);
  const [quizListPageSize, setQuizListPageSize] = useState(20);
  const [quizListTotal, setQuizListTotal] = useState(0);

  const [courseForm, setCourseForm] = useState(() => ({ ...INITIAL_COURSE_FORM }));

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [courseSubTab, setCourseSubTab] = useState('lectures');
  const [lectures, setLectures] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [lectureForm, setLectureForm] = useState(() => ({ title: '', blocks: [newLectureBlock()] }));
  const [lectureEditOpen, setLectureEditOpen] = useState(false);
  const [lectureEditingId, setLectureEditingId] = useState(null);
  const [lectureEditForm, setLectureEditForm] = useState(() => ({ title: '', blocks: [newLectureBlock()] }));
  const [quizForm, setQuizForm] = useState(() => ({ title: '', description: '', questions: [newQuizQuestion()] }));

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userEditingId, setUserEditingId] = useState(null);
  const [userForm, setUserForm] = useState(() => ({ ...INITIAL_USER_FORM }));

  const [courseEditOpen, setCourseEditOpen] = useState(false);
  const [courseEditingId, setCourseEditingId] = useState(null);
  const [courseEditForm, setCourseEditForm] = useState(() => ({
    title: '',
    description: '',
    thumbnail_url: '/img/course-1.png',
    category_id: '',
    published: true,
    duration_hours: '',
    level: DASH_ADMIN.LEVEL_DEFAULT,
  }));

  const [enrollReport, setEnrollReport] = useState(null);
  const [enrollPage, setEnrollPage] = useState(0);
  const [enrollPageSize, setEnrollPageSize] = useState(15);
  const [enrollCourseFilter, setEnrollCourseFilter] = useState('');

  const [quizAnSummary, setQuizAnSummary] = useState(null);
  const [quizAnItems, setQuizAnItems] = useState([]);
  const [quizAnPage, setQuizAnPage] = useState(0);
  const [quizAnPageSize, setQuizAnPageSize] = useState(15);
  const [quizAnTotal, setQuizAnTotal] = useState(0);
  const [quizStatsLoading, setQuizStatsLoading] = useState(false);
  const [contentStats, setContentStats] = useState(null);
  const [contentStatsLoading, setContentStatsLoading] = useState(false);

  const [cmsSubTab, setCmsSubTab] = useState('team');
  const [cmsTeam, setCmsTeam] = useState([]);
  const [teamPage, setTeamPage] = useState(0);
  const [teamPageSize, setTeamPageSize] = useState(10);
  const [teamTotal, setTeamTotal] = useState(0);
  const [teamMetricsItems, setTeamMetricsItems] = useState(null);
  const [cmsTesti, setCmsTesti] = useState([]);
  const [testiPage, setTestiPage] = useState(0);
  const [testiPageSize, setTestiPageSize] = useState(10);
  const [testiTotal, setTestiTotal] = useState(0);
  const [testiMetricsItems, setTestiMetricsItems] = useState(null);
  const [cmsContacts, setCmsContacts] = useState([]);
  const [contactPage, setContactPage] = useState(0);
  const [contactPageSize, setContactPageSize] = useState(10);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactApiMetrics, setContactApiMetrics] = useState(null);
  const [contactViewOpen, setContactViewOpen] = useState(false);
  const [contactViewRow, setContactViewRow] = useState(null);
  const [classPage, setClassPage] = useState(0);
  const [classPageSize, setClassPageSize] = useState(10);
  const [classesItems, setClassesItems] = useState([]);
  const [classTotal, setClassTotal] = useState(0);
  const [classMetrics, setClassMetrics] = useState(null);
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [classEditingId, setClassEditingId] = useState(null);
  const [classForm, setClassForm] = useState({
    name: '',
    slug: '',
    description: '',
    image_url: '',
    teacher_id: '',
    status: 'active',
  });
  const [teacherOptions, setTeacherOptions] = useState([]);
  const [classDetailRow, setClassDetailRow] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [classStudentEmail, setClassStudentEmail] = useState('');
  const [classDetailSubTab, setClassDetailSubTab] = useState('students');
  const [detailTeacherId, setDetailTeacherId] = useState('');
  const [detailClassLectures, setDetailClassLectures] = useState([]);
  const [detailClassLecturesLoading, setDetailClassLecturesLoading] = useState(false);
  const [detailClassQuizzes, setDetailClassQuizzes] = useState([]);
  const [detailClassQuizzesLoading, setDetailClassQuizzesLoading] = useState(false);
  const [detailClassSchedules, setDetailClassSchedules] = useState([]);
  const [detailClassSchedulesLoading, setDetailClassSchedulesLoading] = useState(false);
  const [classDetailLecOpen, setClassDetailLecOpen] = useState(false);
  const [classDetailLecEditing, setClassDetailLecEditing] = useState(null);
  const [classDetailLecForm, setClassDetailLecForm] = useState(() => ({
    title: '',
    blocks: [newLectureBlock()],
    published: true,
    sort_order: 0,
  }));
  const [classDetailQuizOpen, setClassDetailQuizOpen] = useState(false);
  const [classDetailQuizEditing, setClassDetailQuizEditing] = useState(null);
  const [classDetailQuizForm, setClassDetailQuizForm] = useState({
    title: '',
    description: '',
    questions: [newQuizQuestion()],
    sort_order: 0,
  });
  const [classDetailSchOpen, setClassDetailSchOpen] = useState(false);
  const [classDetailSchEditing, setClassDetailSchEditing] = useState(null);
  const [classDetailSchForm, setClassDetailSchForm] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    location: '',
    meeting_url: '',
    notes: '',
    sort_order: 0,
  });
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [teamEditingId, setTeamEditingId] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', role_title: '', image_url: '', bio: '', sort_order: 0 });
  const [testiDialogOpen, setTestiDialogOpen] = useState(false);
  const [testiEditingId, setTestiEditingId] = useState(null);
  const [testiForm, setTestiForm] = useState({
    author_name: '',
    author_title: '',
    author_email: '',
    content: '',
    image_url: '',
    rating: 5,
    sort_order: 0,
  });

  const userAnalytics = useMemo(() => {
    if (!userMetrics) {
      return { total: 0, students: 0, admins: 0, teachers: 0, byRole: [], byDaySeries: [] };
    }
    const teachers = userMetrics.teachers ?? 0;
    return {
      total: userMetrics.total,
      students: userMetrics.students,
      admins: userMetrics.admins,
      teachers,
      byRole: [
        { name: DASH_ADMIN.ROLE_STUDENT, count: userMetrics.students },
        { name: DASH_ADMIN.ROLE_TEACHER, count: teachers },
        { name: DASH_ADMIN.ROLE_ADMIN, count: userMetrics.admins },
      ],
      byDaySeries: userMetrics.byDaySeries,
    };
  }, [userMetrics]);

  const classAnalytics = useMemo(() => {
    if (!classMetrics) {
      return {
        total: 0,
        active: 0,
        archived: 0,
        newIn30d: 0,
        byStatus: [],
        byDaySeries: [],
      };
    }
    const active = classMetrics.active ?? 0;
    const archived = classMetrics.archived ?? 0;
    return {
      total: classMetrics.total ?? 0,
      active,
      archived,
      newIn30d: classMetrics.newIn30d ?? 0,
      byStatus: [
        { name: DASH_ADMIN.CLASS_STATUS_ACTIVE, count: active },
        { name: DASH_ADMIN.CLASS_STATUS_ARCHIVED, count: archived },
      ],
      byDaySeries: classMetrics.byDaySeries ?? [],
    };
  }, [classMetrics]);

  const teamCmsAnalytics = useMemo(
    () => buildTeamCmsAnalytics(teamMetricsItems ?? [], DASH_ADMIN.CMS_ROLE_UNLABELED),
    [teamMetricsItems],
  );

  const testiCmsAnalytics = useMemo(() => {
    const raw = buildTestiCmsAnalytics(testiMetricsItems ?? []);
    return {
      total: raw.total,
      nRated: raw.nRated,
      avgRating: raw.avgRating,
      newIn30d: raw.newIn30d,
      byDaySeries: raw.byDaySeries,
      byRating: raw.byRatingStars.map((r) => ({
        name: DASH_ADMIN.CMS_TESTI_STAR_N.replace('{n}', String(r.stars)),
        count: r.count,
      })),
    };
  }, [testiMetricsItems]);

  const contactCmsAnalytics = useMemo(() => {
    if (contactApiMetrics) {
      return {
        total: contactApiMetrics.total,
        withSubject: contactApiMetrics.withSubject,
        withoutSubject: contactApiMetrics.withoutSubject,
        newIn30d: contactApiMetrics.newIn30d,
        byDaySeries: contactApiMetrics.byDaySeries,
        bySubjectKind: [
          { name: DASH_ADMIN.CMS_CONTACT_HAS_SUBJECT, count: contactApiMetrics.withSubject },
          { name: DASH_ADMIN.CMS_CONTACT_NO_SUBJECT_LABEL, count: contactApiMetrics.withoutSubject },
        ],
      };
    }
    return buildContactCmsAnalytics(
      [],
      DASH_ADMIN.CMS_CONTACT_HAS_SUBJECT,
      DASH_ADMIN.CMS_CONTACT_NO_SUBJECT_LABEL,
    );
  }, [contactApiMetrics]);

  const quizAnalytics = useMemo(
    () => (quizAnSummary ? { ...quizAnSummary, attempts: quizAnItems } : null),
    [quizAnSummary, quizAnItems],
  );

  const coursePublishBars = useMemo(() => {
    const s = contentStats?.summary;
    if (!s) return [];
    return [
      { name: DASH_ADMIN.STATUS_PUBLISHED, count: s.publishedCourses },
      { name: DASH_ADMIN.STATUS_DRAFT, count: s.draftCourses },
    ];
  }, [contentStats]);

  const courseTopByContent = useMemo(() => {
    const rows = contentStats?.byCourse;
    if (!rows?.length) return [];
    return rows.map((c) => {
      const t = c.title || '—';
      return {
        name: t.length > 18 ? `${t.slice(0, 16)}…` : t,
        lectures: c.lectures,
        quizzes: c.quizzes,
      };
    });
  }, [contentStats]);

  const classDetailPickerOptions = useMemo(() => {
    if (!classDetailRow) return classesItems;
    const has = classesItems.some((c) => c.id === classDetailRow.id);
    if (has) return classesItems;
    return [classDetailRow, ...classesItems];
  }, [classesItems, classDetailRow]);

  const resetClassDetailPanel = useCallback(() => {
    setClassDetailRow(null);
    setClassStudents([]);
    setClassStudentEmail('');
    setClassDetailSubTab('students');
    setDetailTeacherId('');
    setDetailClassLectures([]);
    setDetailClassQuizzes([]);
    setDetailClassSchedules([]);
    setClassDetailLecOpen(false);
    setClassDetailLecEditing(null);
    setClassDetailQuizOpen(false);
    setClassDetailQuizEditing(null);
    setClassDetailSchOpen(false);
    setClassDetailSchEditing(null);
  }, []);

  const loadUserMetrics = useCallback(async () => {
    if (!token) return;
    const m = await apiFetch('/api/admin/users/metrics', {}, token);
    setUserMetrics(m);
  }, [token]);

  const loadUsersPage = useCallback(async () => {
    if (!token) return;
    const p = userPage + 1;
    const data = await apiFetch(`/api/admin/users?page=${p}&pageSize=${userPageSize}`, {}, token);
    setUsers(data.items || []);
    setUserTotal(data.total ?? 0);
  }, [token, userPage, userPageSize]);

  const loadCourseOptions = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch('/api/admin/courses/compact', {}, token);
    setCourseOptions(Array.isArray(data) ? data : []);
  }, [token]);

  const loadCoursesPage = useCallback(async () => {
    if (!token) return;
    const p = coursePage + 1;
    const data = await apiFetch(`/api/admin/courses?page=${p}&pageSize=${coursePageSize}`, {}, token);
    setCourses(data.items || []);
    setCourseTotal(data.total ?? 0);
  }, [token, coursePage, coursePageSize]);

  const loadClassesPage = useCallback(async () => {
    if (!token) return;
    const p = classPage + 1;
    const data = await apiFetch(`/api/admin/classes?page=${p}&pageSize=${classPageSize}`, {}, token);
    setClassesItems(data.items || []);
    setClassTotal(data.total ?? 0);
  }, [token, classPage, classPageSize]);

  const loadClassMetrics = useCallback(async () => {
    if (!token) return;
    const m = await apiFetch('/api/admin/classes/metrics', {}, token);
    setClassMetrics(m);
  }, [token]);

  const loadTeacherOptions = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch('/api/admin/users?role=teacher&page=1&pageSize=200', {}, token);
    setTeacherOptions(data.items || []);
  }, [token]);

  const loadClassStudents = useCallback(
    async (classId) => {
      if (!token || !classId) {
        setClassStudents([]);
        return;
      }
      const data = await apiFetch(`/api/admin/classes/${classId}/students?page=1&pageSize=200`, {}, token);
      setClassStudents(data.items || []);
    },
    [token],
  );

  const loadDetailClassLectures = useCallback(
    async (classId) => {
      if (!token || !classId) {
        setDetailClassLectures([]);
        return;
      }
      setDetailClassLecturesLoading(true);
      try {
        const data = await apiFetch(`/api/admin/classes/${classId}/lectures`, {}, token);
        setDetailClassLectures(Array.isArray(data) ? data : []);
      } catch {
        setDetailClassLectures([]);
        toast.error(ERR.LOAD_FAILED);
      } finally {
        setDetailClassLecturesLoading(false);
      }
    },
    [token],
  );

  const loadDetailClassQuizzes = useCallback(
    async (classId) => {
      if (!token || !classId) {
        setDetailClassQuizzes([]);
        return;
      }
      setDetailClassQuizzesLoading(true);
      try {
        const data = await apiFetch(`/api/admin/classes/${classId}/quizzes`, {}, token);
        setDetailClassQuizzes(Array.isArray(data) ? data : []);
      } catch {
        setDetailClassQuizzes([]);
        toast.error(ERR.LOAD_FAILED);
      } finally {
        setDetailClassQuizzesLoading(false);
      }
    },
    [token],
  );

  const loadDetailClassSchedules = useCallback(
    async (classId) => {
      if (!token || !classId) {
        setDetailClassSchedules([]);
        return;
      }
      setDetailClassSchedulesLoading(true);
      try {
        const data = await apiFetch(`/api/admin/classes/${classId}/schedules`, {}, token);
        setDetailClassSchedules(Array.isArray(data) ? data : []);
      } catch {
        setDetailClassSchedules([]);
        toast.error(ERR.LOAD_FAILED);
      } finally {
        setDetailClassSchedulesLoading(false);
      }
    },
    [token],
  );

  const loadCategories = useCallback(async () => {
    const ca = await apiFetch('/api/categories');
    setCategories(ca || []);
  }, []);

  const loadUsersCourses = useCallback(async () => {
    if (!token) return;
    await Promise.all([loadUserMetrics(), loadUsersPage(), loadCategories(), loadCourseOptions(), loadCoursesPage()]);
  }, [token, loadUserMetrics, loadUsersPage, loadCategories, loadCourseOptions, loadCoursesPage]);

  const loadEnrollReport = useCallback(async () => {
    if (!token) return;
    const p = enrollPage + 1;
    const q = new URLSearchParams({
      page: String(p),
      pageSize: String(enrollPageSize),
    });
    if (enrollCourseFilter) q.set('courseId', enrollCourseFilter);
    const [st, list] = await Promise.all([
      apiFetch('/api/admin/enrollments/stats', {}, token),
      apiFetch(`/api/admin/enrollments?${q}`, {}, token),
    ]);
    setEnrollReport({
      stats: st.stats,
      enrollments: list.enrollments || [],
      total: list.total ?? 0,
      page: list.page ?? p,
      pageSize: list.pageSize ?? enrollPageSize,
    });
  }, [token, enrollPage, enrollPageSize, enrollCourseFilter]);

  const loadQuizAnalytics = useCallback(async () => {
    if (!token) return;
    const p = quizAnPage + 1;
    const [summary, attempts] = await Promise.all([
      apiFetch('/api/admin/quiz-analytics/summary', {}, token),
      apiFetch(`/api/admin/quiz-analytics/attempts?page=${p}&pageSize=${quizAnPageSize}`, {}, token),
    ]);
    setQuizAnSummary(summary);
    setQuizAnItems(attempts.items || []);
    setQuizAnTotal(attempts.total ?? 0);
  }, [token, quizAnPage, quizAnPageSize]);

  const loadContentStats = useCallback(
    async (opts = {}) => {
      const silent = opts.silent === true;
      if (!token) return;
      if (!silent) setContentStatsLoading(true);
      try {
        const data = await apiFetch('/api/admin/content-stats', {}, token);
        setContentStats(data);
      } catch (e) {
        toast.error(e.message || ERR.LOAD_FAILED);
      } finally {
        if (!silent) setContentStatsLoading(false);
      }
    },
    [token],
  );

  const loadLecturesQuizzes = useCallback(async () => {
    if (!token || !selectedCourseId) {
      setLectures([]);
      setQuizzes([]);
      setLectureTotal(0);
      setQuizListTotal(0);
      return;
    }
    const lp = lecturePage + 1;
    const qp = quizListPage + 1;
    const [lec, qz] = await Promise.all([
      apiFetch(
        `/api/admin/courses/${selectedCourseId}/lectures?page=${lp}&pageSize=${lecturePageSize}`,
        {},
        token,
      ),
      apiFetch(
        `/api/admin/courses/${selectedCourseId}/quizzes?page=${qp}&pageSize=${quizListPageSize}`,
        {},
        token,
      ),
    ]);
    setLectures(lec.items || []);
    setLectureTotal(lec.total ?? 0);
    setQuizzes(qz.items || []);
    setQuizListTotal(qz.total ?? 0);
  }, [token, selectedCourseId, lecturePage, lecturePageSize, quizListPage, quizListPageSize]);

  const loadCmsTeam = useCallback(async () => {
    if (!token) return;
    try {
      const p = teamPage + 1;
      const [me, page] = await Promise.all([
        apiFetch('/api/admin/team/metrics', {}, token),
        apiFetch(`/api/admin/team?page=${p}&pageSize=${teamPageSize}`, {}, token),
      ]);
      setTeamMetricsItems(me.items || []);
      setCmsTeam(page.items || []);
      setTeamTotal(page.total ?? 0);
    } catch (e) {
      toast.error(e.message || ERR.LOAD_FAILED);
    }
  }, [token, teamPage, teamPageSize]);

  const loadCmsTesti = useCallback(async () => {
    if (!token) return;
    try {
      const p = testiPage + 1;
      const [me, page] = await Promise.all([
        apiFetch('/api/admin/testimonials/metrics', {}, token),
        apiFetch(`/api/admin/testimonials?page=${p}&pageSize=${testiPageSize}`, {}, token),
      ]);
      setTestiMetricsItems(me.items || []);
      setCmsTesti(page.items || []);
      setTestiTotal(page.total ?? 0);
    } catch (e) {
      toast.error(e.message || ERR.LOAD_FAILED);
    }
  }, [token, testiPage, testiPageSize]);

  const loadCmsContacts = useCallback(async () => {
    if (!token) return;
    try {
      const p = contactPage + 1;
      const [me, page] = await Promise.all([
        apiFetch('/api/admin/contact-messages/metrics', {}, token),
        apiFetch(`/api/admin/contact-messages?page=${p}&pageSize=${contactPageSize}`, {}, token),
      ]);
      setContactApiMetrics(me);
      setCmsContacts(page.items || []);
      setContactTotal(page.total ?? 0);
    } catch (e) {
      toast.error(e.message || ERR.LOAD_FAILED);
    }
  }, [token, contactPage, contactPageSize]);

  useEffect(() => {
    if (!token) return;
    void loadUserMetrics();
  }, [token, loadUserMetrics]);

  useEffect(() => {
    if (!token) return;
    void loadCategories();
    void loadCourseOptions();
  }, [token, loadCategories, loadCourseOptions]);

  useEffect(() => {
    if (!token) return;
    void loadUsersPage();
  }, [token, userPage, userPageSize, loadUsersPage]);

  useEffect(() => {
    if (!token) return;
    void loadCoursesPage();
  }, [token, coursePage, coursePageSize, loadCoursesPage]);

  useEffect(() => {
    if (courseOptions.length === 0) {
      setSelectedCourseId('');
      return;
    }
    setSelectedCourseId((prev) => {
      if (prev && courseOptions.some((c) => c.id === prev)) return prev;
      return courseOptions[0].id;
    });
  }, [courseOptions]);

  useEffect(() => {
    setLecturePage(0);
    setQuizListPage(0);
  }, [selectedCourseId]);

  useEffect(() => {
    setEnrollPage(0);
  }, [enrollCourseFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!token || !selectedCourseId) return;
        await loadLecturesQuizzes();
      } catch (e) {
        if (!cancelled) toast.error(e.message || ERR.LOAD_FAILED);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, selectedCourseId, loadLecturesQuizzes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tab !== 'courses' || courseArea !== 'enrollments' || !token) return;
      try {
        await loadEnrollReport();
      } catch (e) {
        if (!cancelled) toast.error(e.message || ERR.LOAD_ENROLL_REPORT);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, courseArea, token, loadEnrollReport]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (tab !== 'courses' || courseArea !== 'quiz_stats' || !token) return;
      setQuizStatsLoading(true);
      try {
        await loadQuizAnalytics();
      } catch (e) {
        if (!cancelled) toast.error(e.message || ERR.LOAD_QUIZ_ANALYTICS);
      } finally {
        if (!cancelled) setQuizStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, courseArea, token, loadQuizAnalytics]);

  useEffect(() => {
    if (tab !== 'courses' || courseArea !== 'overview' || !token) return;
    void loadContentStats();
  }, [tab, courseArea, token, loadContentStats]);

  useEffect(() => {
    if (tab !== 'content' || cmsSubTab !== 'team' || !token) return;
    void loadCmsTeam();
  }, [tab, cmsSubTab, token, loadCmsTeam]);

  useEffect(() => {
    if (tab !== 'content' || cmsSubTab !== 'testi' || !token) return;
    void loadCmsTesti();
  }, [tab, cmsSubTab, token, loadCmsTesti]);

  useEffect(() => {
    if (tab !== 'content' || cmsSubTab !== 'contact' || !token) return;
    void loadCmsContacts();
  }, [tab, cmsSubTab, token, loadCmsContacts]);

  useEffect(() => {
    if (tab !== 'classes' || !token) return;
    void loadClassesPage();
  }, [tab, token, loadClassesPage]);

  useEffect(() => {
    if (tab !== 'classes' || !token) return;
    void loadClassMetrics();
  }, [tab, token, loadClassMetrics]);

  useEffect(() => {
    if (tab !== 'classes' || !token) return;
    void loadTeacherOptions();
  }, [tab, token, loadTeacherOptions]);

  useEffect(() => {
    if (tab !== 'classes') {
      resetClassDetailPanel();
    }
  }, [tab, resetClassDetailPanel]);

  useEffect(() => {
    if (!classDetailRow?.id || tab !== 'classes') return;
    const id = classDetailRow.id;
    if (classDetailSubTab === 'students') {
      void loadClassStudents(id);
    } else if (classDetailSubTab === 'teacher') {
      setDetailTeacherId(classDetailRow.teacher_id || '');
      void loadTeacherOptions();
    } else if (classDetailSubTab === 'lectures') {
      void loadDetailClassLectures(id);
    } else if (classDetailSubTab === 'quizzes') {
      void loadDetailClassQuizzes(id);
    } else if (classDetailSubTab === 'schedule') {
      void loadDetailClassSchedules(id);
    }
  }, [
    classDetailRow,
    classDetailSubTab,
    tab,
    loadClassStudents,
    loadTeacherOptions,
    loadDetailClassLectures,
    loadDetailClassQuizzes,
    loadDetailClassSchedules,
  ]);

  function openCreateUser() {
    setUserEditingId(null);
    setUserForm({ ...INITIAL_USER_FORM });
    setUserDialogOpen(true);
  }

  function openEditUser(u) {
    setUserEditingId(u.id);
    setUserForm({
      email: u.email || '',
      password: '',
      full_name: u.full_name || '',
      role: u.role || 'student',
    });
    setUserDialogOpen(true);
  }

  async function submitUserForm(e) {
    e.preventDefault();
    const isCreate = !userEditingId;
    if (!userForm.email.trim()) {
      toast.error(DASH_ADMIN.EMAIL_REQUIRED);
      return;
    }
    if (isCreate && !userForm.password) {
      toast.error(DASH_ADMIN.PASSWORD_REQUIRED);
      return;
    }
    try {
      if (isCreate) {
        await apiFetch(
          '/api/admin/users',
          {
            method: 'POST',
            body: JSON.stringify({
              email: userForm.email.trim(),
              password: userForm.password,
              full_name: userForm.full_name.trim() || null,
              role: userForm.role,
            }),
          },
          token,
        );
        toast.success(DASH_ADMIN.USER_CREATED);
      } else {
        const body = {
          email: userForm.email.trim(),
          full_name: userForm.full_name.trim() || null,
          role: userForm.role,
        };
        if (userForm.password) body.password = userForm.password;
        await apiFetch(`/api/admin/users/${userEditingId}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.USER_UPDATED);
      }
      setUserDialogOpen(false);
      await loadUsersCourses();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteUserRow(userId) {
    if (userId === user?.id) {
      toast.error(DASH_ADMIN.CANNOT_DELETE_SELF);
      return;
    }
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_USER)) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadUsersCourses();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openCreateClass() {
    setClassEditingId(null);
    setClassForm({
      name: '',
      slug: '',
      description: '',
      image_url: '',
      teacher_id: teacherOptions[0]?.id || '',
      status: 'active',
    });
    setClassDialogOpen(true);
    void loadTeacherOptions();
  }

  function openEditClass(row) {
    setClassEditingId(row.id);
    setClassForm({
      name: row.name || '',
      slug: row.slug || '',
      description: row.description || '',
      image_url: row.image_url || '',
      teacher_id: row.teacher_id || '',
      status: row.status || 'active',
    });
    setClassDialogOpen(true);
    void loadTeacherOptions();
  }

  async function submitClassForm(e) {
    e.preventDefault();
    if (!classForm.name.trim()) {
      toast.error(DASH_ADMIN.CLASS_NAME_REQUIRED);
      return;
    }
    if (!classForm.teacher_id) {
      toast.error(DASH_ADMIN.CLASS_TEACHER_REQUIRED);
      return;
    }
    try {
      if (!classEditingId) {
        const body = {
          name: classForm.name.trim(),
          description: classForm.description.trim() || null,
          image_url: classForm.image_url.trim() || null,
          teacher_id: classForm.teacher_id,
          status: classForm.status,
        };
        if (classForm.slug.trim()) body.slug = classForm.slug.trim();
        await apiFetch('/api/admin/classes', { method: 'POST', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.CLASS_CREATED);
      } else {
        const body = {
          name: classForm.name.trim(),
          description: classForm.description.trim() || null,
          image_url: classForm.image_url.trim() || null,
          teacher_id: classForm.teacher_id,
          status: classForm.status,
        };
        await apiFetch(`/api/admin/classes/${classEditingId}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.CLASS_UPDATED);
      }
      setClassDialogOpen(false);
      await loadClassesPage();
      await loadClassMetrics();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteClassRow(row) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_CLASS)) return;
    try {
      await apiFetch(`/api/admin/classes/${row.id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      if (classDetailRow?.id === row.id) {
        resetClassDetailPanel();
      }
      await loadClassesPage();
      await loadClassMetrics();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addStudentToClassByEmail() {
    if (!classDetailRow?.id || !classStudentEmail.trim()) return;
    try {
      const profile = await apiFetch(
        `/api/admin/users/by-email?email=${encodeURIComponent(classStudentEmail.trim().toLowerCase())}`,
        {},
        token,
      );
      if (profile.role !== 'student') {
        toast.error(DASH_ADMIN.USER_NOT_STUDENT);
        return;
      }
      await apiFetch(
        `/api/admin/classes/${classDetailRow.id}/students`,
        { method: 'POST', body: JSON.stringify({ student_id: profile.id }) },
        token,
      );
      toast.success(DASH_ADMIN.CLASS_STUDENT_ADDED);
      setClassStudentEmail('');
      await loadClassStudents(classDetailRow.id);
    } catch (err) {
      if (err.status === 404) toast.error(DASH_ADMIN.USER_LOOKUP_NOT_FOUND);
      else toast.error(err.data?.error || err.message);
    }
  }

  async function removeStudentFromClass(studentId) {
    if (!classDetailRow?.id) return;
    try {
      await apiFetch(`/api/admin/classes/${classDetailRow.id}/students/${studentId}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.CLASS_STUDENT_REMOVED);
      await loadClassStudents(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function saveDetailClassTeacher() {
    if (!classDetailRow?.id || !detailTeacherId) return;
    try {
      const row = await apiFetch(
        `/api/admin/classes/${classDetailRow.id}`,
        { method: 'PATCH', body: JSON.stringify({ teacher_id: detailTeacherId }) },
        token,
      );
      toast.success(DASH_ADMIN.CLASS_TEACHER_UPDATED);
      setClassDetailRow((prev) => (prev && prev.id === row.id ? { ...prev, ...row, teacher: row.teacher } : prev));
      await loadClassesPage();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openClassDetailLectureCreate() {
    setClassDetailLecEditing(null);
    setClassDetailLecForm({ title: '', blocks: [newLectureBlock()], published: true, sort_order: 0 });
    setClassDetailLecOpen(true);
  }

  function openClassDetailLectureEdit(lec) {
    setClassDetailLecEditing(lec);
    setClassDetailLecForm({
      title: lec.title || '',
      blocks: blocksFromLectureForForm(lec),
      published: lec.published !== false,
      sort_order: lec.sort_order ?? 0,
    });
    setClassDetailLecOpen(true);
  }

  async function submitClassDetailLecture(e) {
    e.preventDefault();
    if (!classDetailRow?.id) return;
    const title = String(classDetailLecForm.title || '').trim();
    if (!title) {
      toast.error(DASH_ADMIN.LECTURE_TITLE_REQUIRED);
      return;
    }
    const blocks = normalizeBlocksForApi(classDetailLecForm.blocks);
    if (!blocks.length) {
      toast.error(DASH_ADMIN.LECTURE_BLOCKS_EMPTY);
      return;
    }
    const body = {
      title,
      blocks,
      sort_order: Number(classDetailLecForm.sort_order) || 0,
      published: Boolean(classDetailLecForm.published),
    };
    try {
      if (!classDetailLecEditing) {
        await apiFetch(
          `/api/admin/classes/${classDetailRow.id}/lectures`,
          { method: 'POST', body: JSON.stringify(body) },
          token,
        );
        toast.success(DASH_ADMIN.TOAST_LECTURE_ADDED);
      } else {
        await apiFetch(`/api/admin/class-lectures/${classDetailLecEditing.id}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.TOAST_LECTURE_UPDATED);
      }
      setClassDetailLecOpen(false);
      setClassDetailLecEditing(null);
      await loadDetailClassLectures(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteClassDetailLecture(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_LECTURE)) return;
    if (!classDetailRow?.id) return;
    try {
      await apiFetch(`/api/admin/class-lectures/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadDetailClassLectures(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openClassDetailQuizCreate() {
    setClassDetailQuizEditing(null);
    setClassDetailQuizForm({ title: '', description: '', questions: [newQuizQuestion()], sort_order: 0 });
    setClassDetailQuizOpen(true);
  }

  function openClassDetailQuizEdit(row) {
    setClassDetailQuizEditing(row);
    setClassDetailQuizForm({
      title: row.title || '',
      description: row.description || '',
      questions: quizFormRowsFromApi(row.questions),
      sort_order: row.sort_order ?? 0,
    });
    setClassDetailQuizOpen(true);
  }

  async function submitClassDetailQuiz(e) {
    e.preventDefault();
    if (!classDetailRow?.id) return;
    if (!String(classDetailQuizForm.title || '').trim()) return;
    const built = buildQuizPayloadFromFormRows(classDetailQuizForm.questions);
    if (built.error === 'NEED_QUESTION') {
      toast.error(DASH_ADMIN.QUIZ_NEED_QUESTION);
      return;
    }
    if (built.error === 'OPTIONS_REQUIRED') {
      toast.error(DASH_ADMIN.QUIZ_OPTIONS_REQUIRED);
      return;
    }
    const base = {
      title: classDetailQuizForm.title.trim(),
      description: classDetailQuizForm.description?.trim() || null,
      questions: built.questions,
      sort_order: Number(classDetailQuizForm.sort_order) || 0,
    };
    try {
      if (!classDetailQuizEditing) {
        await apiFetch(`/api/admin/classes/${classDetailRow.id}/quizzes`, { method: 'POST', body: JSON.stringify(base) }, token);
        toast.success(DASH_ADMIN.TOAST_QUIZ_ADDED);
      } else {
        await apiFetch(`/api/admin/class-quizzes/${classDetailQuizEditing.id}`, { method: 'PATCH', body: JSON.stringify(base) }, token);
        toast.success(DASH_ADMIN.TOAST_QUIZ_UPDATED);
      }
      setClassDetailQuizOpen(false);
      setClassDetailQuizEditing(null);
      await loadDetailClassQuizzes(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteClassDetailQuiz(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_QUIZ)) return;
    if (!classDetailRow?.id) return;
    try {
      await apiFetch(`/api/admin/class-quizzes/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadDetailClassQuizzes(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openClassDetailSchCreate() {
    setClassDetailSchEditing(null);
    setClassDetailSchForm({
      title: '',
      starts_at: '',
      ends_at: '',
      location: '',
      meeting_url: '',
      notes: '',
      sort_order: 0,
    });
    setClassDetailSchOpen(true);
  }

  function openClassDetailSchEdit(row) {
    setClassDetailSchEditing(row);
    setClassDetailSchForm({
      title: row.title || '',
      starts_at: row.starts_at ? String(row.starts_at).slice(0, 16) : '',
      ends_at: row.ends_at ? String(row.ends_at).slice(0, 16) : '',
      location: row.location || '',
      meeting_url: row.meeting_url || '',
      notes: row.notes || '',
      sort_order: row.sort_order ?? 0,
    });
    setClassDetailSchOpen(true);
  }

  async function submitClassDetailSchedule(e) {
    e.preventDefault();
    if (!classDetailRow?.id || !String(classDetailSchForm.title || '').trim() || !classDetailSchForm.starts_at) return;
    const payload = {
      title: classDetailSchForm.title.trim(),
      starts_at: classDetailSchForm.starts_at,
      ends_at: classDetailSchForm.ends_at || null,
      location: classDetailSchForm.location.trim() || null,
      meeting_url: classDetailSchForm.meeting_url.trim() || null,
      notes: classDetailSchForm.notes.trim() || null,
      sort_order: Number(classDetailSchForm.sort_order) || 0,
    };
    try {
      if (!classDetailSchEditing) {
        await apiFetch(`/api/admin/classes/${classDetailRow.id}/schedules`, { method: 'POST', body: JSON.stringify(payload) }, token);
        toast.success(COMMON.SAVE);
      } else {
        await apiFetch(`/api/admin/class-schedules/${classDetailSchEditing.id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token);
        toast.success(COMMON.SAVE);
      }
      setClassDetailSchOpen(false);
      setClassDetailSchEditing(null);
      await loadDetailClassSchedules(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteClassDetailSchedule(id) {
    if (!confirm(DASH_ADMIN.CLASS_CONFIRM_DEL_SCHEDULE)) return;
    if (!classDetailRow?.id) return;
    try {
      await apiFetch(`/api/admin/class-schedules/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadDetailClassSchedules(classDetailRow.id);
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addCourse(e) {
    e.preventDefault();
    try {
      await apiFetch(
        '/api/admin/courses',
        {
          method: 'POST',
          body: JSON.stringify({
            title: courseForm.title,
            description: courseForm.description || null,
            thumbnail_url: courseForm.thumbnail_url || null,
            category_id: courseForm.category_id || null,
            published: courseForm.published,
            duration_hours: courseForm.duration_hours === '' ? null : Number(courseForm.duration_hours),
            level: courseForm.level || null,
            rating: courseForm.rating === '' ? null : Number(courseForm.rating),
            learners_count: courseForm.learners_count || null,
          }),
        },
        token,
      );
      toast.success(DASH_ADMIN.COURSE_CREATED);
      setCourseForm({ ...INITIAL_COURSE_FORM });
      await loadUsersCourses();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteCourse(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_COURSE)) return;
    try {
      await apiFetch(`/api/admin/courses/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadUsersCourses();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  function openEditCourse(c) {
    setCourseEditingId(c.id);
    setCourseEditForm({
      title: c.title || '',
      description: c.description ?? '',
      thumbnail_url: c.thumbnail_url || '/img/course-1.png',
      category_id: c.category_id || '',
      published: !!c.published,
      duration_hours: c.duration_hours != null && c.duration_hours !== '' ? String(c.duration_hours) : '',
      level: c.level || DASH_ADMIN.LEVEL_DEFAULT,
    });
    setCourseEditOpen(true);
  }

  async function submitCourseEdit(e) {
    e.preventDefault();
    if (!courseEditingId) return;
    const title = String(courseEditForm.title || '').trim();
    if (!title) {
      toast.error(DASH_ADMIN.TITLE_REQUIRED);
      return;
    }
    try {
      await apiFetch(
        `/api/admin/courses/${courseEditingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            description: courseEditForm.description?.trim() || null,
            thumbnail_url: courseEditForm.thumbnail_url?.trim() || null,
            category_id: courseEditForm.category_id || null,
            published: !!courseEditForm.published,
            duration_hours: courseEditForm.duration_hours === '' ? null : Number(courseEditForm.duration_hours),
            level: courseEditForm.level?.trim() || null,
          }),
        },
        token,
      );
      toast.success(DASH_ADMIN.COURSE_UPDATED);
      setCourseEditOpen(false);
      setCourseEditingId(null);
      await loadUsersCourses();
      await loadContentStats({ silent: true });
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addLecture(e) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const blocks = normalizeBlocksForApi(lectureForm.blocks);
    if (!blocks.length) {
      toast.error(DASH_ADMIN.LECTURE_BLOCKS_EMPTY);
      return;
    }
    try {
      await apiFetch(
        `/api/admin/courses/${selectedCourseId}/lectures`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: lectureForm.title,
            blocks,
          }),
        },
        token,
      );
      setLectureForm({ title: '', blocks: [newLectureBlock()] });
      toast.success(DASH_ADMIN.TOAST_LECTURE_ADDED);
      await loadLecturesQuizzes();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteLecture(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_LECTURE)) return;
    try {
      await apiFetch(`/api/admin/lectures/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadLecturesQuizzes();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  function openEditLecture(lec) {
    setLectureEditingId(lec.id);
    setLectureEditForm({
      title: lec.title || '',
      blocks: blocksFromLectureForForm(lec),
    });
    setLectureEditOpen(true);
  }

  async function submitLectureEdit(e) {
    e.preventDefault();
    if (!lectureEditingId) return;
    const title = String(lectureEditForm.title || '').trim();
    if (!title) {
      toast.error(DASH_ADMIN.LECTURE_TITLE_REQUIRED);
      return;
    }
    const blocks = normalizeBlocksForApi(lectureEditForm.blocks);
    if (!blocks.length) {
      toast.error(DASH_ADMIN.LECTURE_BLOCKS_EMPTY);
      return;
    }
    try {
      await apiFetch(
        `/api/admin/lectures/${lectureEditingId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ title, blocks }),
        },
        token,
      );
      toast.success(DASH_ADMIN.TOAST_LECTURE_UPDATED);
      setLectureEditOpen(false);
      setLectureEditingId(null);
      await loadLecturesQuizzes();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function addQuiz(e) {
    e.preventDefault();
    if (!selectedCourseId) return;
    const built = quizForm.questions
      .filter((row) => (row.question || '').trim())
      .map((row) => {
        const options = [row.a, row.b, row.c, row.d].map((s) => (s != null ? String(s).trim() : ''));
        const correct = Number(row.correct);
        const correctIndex = correct >= 0 && correct <= 3 ? correct : 0;
        return { question: row.question.trim(), options, correctIndex };
      });
    if (!built.length) {
      toast.error(DASH_ADMIN.QUIZ_NEED_QUESTION);
      return;
    }
    for (const q of built) {
      if (q.options.some((o) => !o)) {
        toast.error(DASH_ADMIN.QUIZ_OPTIONS_REQUIRED);
        return;
      }
    }
    try {
      await apiFetch(
        `/api/admin/courses/${selectedCourseId}/quizzes`,
        {
          method: 'POST',
          body: JSON.stringify({
            title: quizForm.title,
            description: quizForm.description || null,
            questions: built,
          }),
        },
        token,
      );
      setQuizForm({ title: '', description: '', questions: [newQuizQuestion()] });
      toast.success(DASH_ADMIN.TOAST_QUIZ_ADDED);
      await loadLecturesQuizzes();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  async function deleteQuiz(id) {
    if (!confirm(DASH_ADMIN.CONFIRM_DEL_QUIZ)) return;
    try {
      await apiFetch(`/api/admin/quizzes/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadLecturesQuizzes();
      await loadContentStats({ silent: true });
    } catch (e) {
      toast.error(e.data?.error || e.message);
    }
  }

  function openTeamCreate() {
    setTeamEditingId(null);
    setTeamForm({ name: '', role_title: '', image_url: '', bio: '', sort_order: 0 });
    setTeamDialogOpen(true);
  }

  function openTeamEdit(row) {
    setTeamEditingId(row.id);
    setTeamForm({
      name: row.name || '',
      role_title: row.role_title ?? '',
      image_url: row.image_url ?? '',
      bio: row.bio ?? '',
      sort_order: row.sort_order ?? 0,
    });
    setTeamDialogOpen(true);
  }

  async function submitTeamForm(e) {
    e.preventDefault();
    if (!token || !teamForm.name.trim()) {
      toast.error(DASH_ADMIN.CMS_ERR_TEAM_NAME);
      return;
    }
    const body = {
      name: teamForm.name.trim(),
      role_title: teamForm.role_title?.trim() || null,
      image_url: teamForm.image_url?.trim() || null,
      bio: teamForm.bio?.trim() || null,
      sort_order: Number(teamForm.sort_order) || 0,
    };
    try {
      if (teamEditingId) {
        await apiFetch(`/api/admin/team/${teamEditingId}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.CMS_TOAST_UPDATED);
      } else {
        await apiFetch('/api/admin/team', { method: 'POST', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.TOAST_TEAM_ADDED);
      }
      setTeamDialogOpen(false);
      setTeamEditingId(null);
      await loadCmsTeam();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteTeamRow(id) {
    if (!confirm(DASH_ADMIN.CMS_CONFIRM_DEL_TEAM)) return;
    try {
      await apiFetch(`/api/admin/team/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadCmsTeam();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  function openTestiCreate() {
    setTestiEditingId(null);
    setTestiForm({ author_name: '', author_title: '', author_email: '', content: '', image_url: '', rating: 5, sort_order: 0 });
    setTestiDialogOpen(true);
  }

  function openTestiEdit(row) {
    setTestiEditingId(row.id);
    setTestiForm({
      author_name: row.author_name || '',
      author_title: row.author_title ?? '',
      author_email: row.author_email ?? '',
      content: row.content || '',
      image_url: row.image_url ?? '',
      rating: row.rating ?? 5,
      sort_order: row.sort_order ?? 0,
    });
    setTestiDialogOpen(true);
  }

  async function submitTestiForm(e) {
    e.preventDefault();
    if (!token || !testiForm.author_name.trim() || !testiForm.content.trim()) {
      toast.error(DASH_ADMIN.CMS_ERR_TESTI_FIELDS);
      return;
    }
    const body = {
      author_name: testiForm.author_name.trim(),
      author_title: testiForm.author_title?.trim() || null,
      author_email: testiForm.author_email?.trim() || null,
      content: testiForm.content.trim(),
      image_url: testiForm.image_url?.trim() || null,
      rating: Number(testiForm.rating) || null,
      sort_order: Number(testiForm.sort_order) || 0,
    };
    try {
      if (testiEditingId) {
        await apiFetch(`/api/admin/testimonials/${testiEditingId}`, { method: 'PATCH', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.CMS_TOAST_UPDATED);
      } else {
        await apiFetch('/api/admin/testimonials', { method: 'POST', body: JSON.stringify(body) }, token);
        toast.success(DASH_ADMIN.TOAST_TEST_ADDED);
      }
      setTestiDialogOpen(false);
      setTestiEditingId(null);
      await loadCmsTesti();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteTestiRow(id) {
    if (!confirm(DASH_ADMIN.CMS_CONFIRM_DEL_TESTI)) return;
    try {
      await apiFetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      await loadCmsTesti();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  async function deleteContactRow(id) {
    if (!confirm(DASH_ADMIN.CMS_CONFIRM_DEL_CONTACT)) return;
    if (!token) return;
    try {
      await apiFetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' }, token);
      toast.success(DASH_ADMIN.TOAST_DELETED);
      if (contactViewRow?.id === id) {
        setContactViewOpen(false);
        setContactViewRow(null);
      }
      await loadCmsContacts();
    } catch (err) {
      toast.error(err.data?.error || err.message);
    }
  }

  return (
    <>
      <Box
        sx={{
          bgcolor: 'background.default',
          py: { xs: 2, md: 3 },
          minHeight: { xs: '50vh', md: '56vh' },
        }}
      >
        <div className="container mx-auto max-w-6xl px-4 pb-2">
          <AdminShell
            tab={tab}
            onTabChange={setTab}
            headerTitle={DASH_ADMIN.TITLE}
            headerCrumbs={[{ label: DASH_ADMIN.CRUMB, active: true }]}
          >
            {tab === 'users' && (
              <Stack spacing={3}>
                <AdminSectionCard title={DASH_ADMIN.USER_STATS_SECTION}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.USER_STATS_TOTAL}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {userAnalytics.total}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.USER_STATS_STUDENT_COUNT}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {userAnalytics.students}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.USER_STATS_TEACHER_COUNT}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {userAnalytics.teachers}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.USER_STATS_ADMIN_COUNT}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {userAnalytics.admins}
                      </Typography>
                    </Paper>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                      minHeight: 280,
                    }}
                  >
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                        {DASH_ADMIN.USER_CHART_BY_ROLE}
                      </Typography>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={userAnalytics.byRole} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} width={36} />
                          <RechartsTooltip />
                          <Bar
                            dataKey="count"
                            name={DASH_ADMIN.USER_CHART_LEGEND_COUNT}
                            fill={chartPrimary}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                        {DASH_ADMIN.USER_CHART_SIGNUPS_30D}
                      </Typography>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={userAnalytics.byDaySeries} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                          <YAxis allowDecimals={false} width={36} />
                          <RechartsTooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name={DASH_ADMIN.USER_CHART_LEGEND_NEW_PER_DAY}
                            stroke={chartSecondary}
                            strokeWidth={2}
                            dot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Box>
                </AdminSectionCard>

                <AdminSectionCard
                  overline={DASH_ADMIN.LEAD_USERS}
                  title={DASH_ADMIN.TABS.users}
                  action={
                    <Button variant="contained" size="medium" startIcon={<UserPlus size={18} />} onClick={openCreateUser}>
                      {DASH_ADMIN.BTN_ADD_USER}
                    </Button>
                  }
                >
                  <AdminDataTable>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_NAME}</TableCell>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_EMAIL}</TableCell>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ROLE}</TableCell>
                        <TableCell align="right" sx={adminHeaderCellSx}>
                          {DASH_ADMIN.TH_ACTIONS}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow key={u.id} sx={adminBodyRowSx}>
                          <TableCell>{u.full_name || '—'}</TableCell>
                          <TableCell>{u.email || '—'}</TableCell>
                          <TableCell>
                            {u.role === 'admin' ? (
                              <Chip label={DASH_ADMIN.ROLE_ADMIN} color="secondary" size="small" sx={{ fontWeight: 700 }} />
                            ) : u.role === 'teacher' ? (
                              <Chip label={DASH_ADMIN.ROLE_TEACHER} color="info" size="small" sx={{ fontWeight: 700 }} />
                            ) : (
                              <Chip label={DASH_ADMIN.ROLE_STUDENT} color="primary" variant="outlined" size="small" sx={{ fontWeight: 600 }} />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                              <Button type="button" variant="outlined" size="small" onClick={() => openEditUser(u)}>
                                {DASH_ADMIN.BTN_EDIT}
                              </Button>
                              <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                <span>
                                  <IconButton
                                    type="button"
                                    color="error"
                                    size="small"
                                    disabled={u.id === user?.id}
                                    onClick={() => deleteUserRow(u.id)}
                                    aria-label={DASH_ADMIN.DELETE_TOOLTIP}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminDataTable>
                  <AdminListPagination
                    page={userPage}
                    pageSize={userPageSize}
                    total={userTotal}
                    onPageChange={(_, p) => setUserPage(p)}
                    onPageSizeChange={(e) => {
                      setUserPageSize(parseInt(e.target.value, 10));
                      setUserPage(0);
                    }}
                    labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                    labelDisplayedRows={({ from, to, count }) =>
                      count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                    }
                    sx={{ borderTop: 1, borderColor: 'divider' }}
                  />
                </AdminSectionCard>
              </Stack>
            )}

            {tab === 'classes' && (
              <Stack spacing={3}>
                <AdminSectionCard title={DASH_ADMIN.CLASS_STATS_SECTION}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                      gap: 2,
                      mb: 3,
                    }}
                  >
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.CLASS_STATS_TOTAL}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {classAnalytics.total}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.CLASS_STATS_ACTIVE_COUNT}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {classAnalytics.active}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.CLASS_STATS_ARCHIVED_COUNT}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {classAnalytics.archived}
                      </Typography>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                        {DASH_ADMIN.CLASS_STATS_NEW_30D}
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                        {classAnalytics.newIn30d}
                      </Typography>
                    </Paper>
                  </Box>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                      gap: 2,
                      minHeight: 280,
                    }}
                  >
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                        {DASH_ADMIN.CLASS_CHART_BY_STATUS}
                      </Typography>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={classAnalytics.byStatus} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} width={36} />
                          <RechartsTooltip />
                          <Bar
                            dataKey="count"
                            name={DASH_ADMIN.CLASS_CHART_LEGEND_COUNT}
                            fill={chartPrimary}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Paper>
                    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                        {DASH_ADMIN.CLASS_CHART_NEW_30D}
                      </Typography>
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={classAnalytics.byDaySeries} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                          <YAxis allowDecimals={false} width={36} />
                          <RechartsTooltip />
                          <Line
                            type="monotone"
                            dataKey="count"
                            name={DASH_ADMIN.CLASS_CHART_LEGEND_NEW_PER_DAY}
                            stroke={chartSecondary}
                            strokeWidth={2}
                            dot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Paper>
                  </Box>
                </AdminSectionCard>

                <AdminSectionCard
                  overline={DASH_ADMIN.LEAD_CLASSES}
                  title={DASH_ADMIN.SECTION_CLASS_LIST}
                  action={
                    <Button variant="contained" size="medium" startIcon={<PlusCircle size={18} />} onClick={openCreateClass}>
                      {DASH_ADMIN.BTN_ADD_CLASS}
                    </Button>
                  }
                >
                  <AdminDataTable>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CLASS_NAME}</TableCell>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_CLASS_SLUG}</TableCell>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_CLASS_TEACHER}</TableCell>
                        <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CLASS_STATUS}</TableCell>
                        <TableCell align="right" sx={adminHeaderCellSx}>
                          {DASH_ADMIN.TH_ACTIONS}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {classesItems.map((row) => (
                        <TableRow key={row.id} sx={adminBodyRowSx}>
                          <TableCell>{row.name}</TableCell>
                          <TableCell>{row.slug}</TableCell>
                          <TableCell>
                            {row.teacher?.full_name || row.teacher?.email || row.teacher_id || '—'}
                          </TableCell>
                          <TableCell>
                            {row.status === 'archived' ? DASH_ADMIN.CLASS_STATUS_ARCHIVED : DASH_ADMIN.CLASS_STATUS_ACTIVE}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
                              <Button
                                type="button"
                                variant="outlined"
                                size="small"
                                startIcon={<GraduationCap size={16} />}
                                onClick={() => {
                                  setClassDetailSubTab('students');
                                  setDetailClassLectures([]);
                                  setDetailClassQuizzes([]);
                                  setDetailClassSchedules([]);
                                  setClassDetailRow(row);
                                  setClassStudentEmail('');
                                }}
                              >
                                {DASH_ADMIN.BTN_MANAGE_CLASS}
                              </Button>
                              <Button type="button" variant="outlined" size="small" onClick={() => openEditClass(row)}>
                                {DASH_ADMIN.BTN_EDIT}
                              </Button>
                              <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                <span>
                                  <IconButton
                                    type="button"
                                    color="error"
                                    size="small"
                                    onClick={() => deleteClassRow(row)}
                                    aria-label={DASH_ADMIN.DELETE_TOOLTIP}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </AdminDataTable>
                  <AdminListPagination
                    page={classPage}
                    pageSize={classPageSize}
                    total={classTotal}
                    onPageChange={(_, p) => setClassPage(p)}
                    onPageSizeChange={(e) => {
                      setClassPageSize(parseInt(e.target.value, 10));
                      setClassPage(0);
                    }}
                    labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                    labelDisplayedRows={({ from, to, count }) =>
                      count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                    }
                    sx={{ borderTop: 1, borderColor: 'divider' }}
                  />
                </AdminSectionCard>

                {classDetailRow && (
                  <AdminSectionCard
                    overline={DASH_ADMIN.CLASS_MANAGE_SECTION_OVERLINE}
                    title={classDetailRow.name}
                    action={
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <InputLabel id="class-inline-switch">{DASH_ADMIN.CLASS_DETAIL_SWITCH}</InputLabel>
                          <Select
                            labelId="class-inline-switch"
                            label={DASH_ADMIN.CLASS_DETAIL_SWITCH}
                            value={classDetailRow.id}
                            onChange={(e) => {
                              const id = e.target.value;
                              const row = classDetailPickerOptions.find((c) => c.id === id);
                              if (row) {
                                setClassDetailRow(row);
                                setClassDetailSubTab('students');
                                setClassStudentEmail('');
                                setDetailClassLectures([]);
                                setDetailClassQuizzes([]);
                                setDetailClassSchedules([]);
                              }
                            }}
                          >
                            {classDetailPickerOptions.map((c) => (
                              <MenuItem key={c.id} value={c.id}>
                                {c.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button variant="outlined" size="small" onClick={resetClassDetailPanel}>
                          {DASH_ADMIN.BTN_CLOSE_PANEL}
                        </Button>
                      </Stack>
                    }
                  >
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                      <Tabs
                        value={classDetailSubTab}
                        onChange={(_, v) => setClassDetailSubTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                        sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 700 } }}
                      >
                        <Tab value="students" label={DASH_ADMIN.CLASS_TAB_STUDENTS} />
                        <Tab value="teacher" label={DASH_ADMIN.CLASS_TAB_TEACHER} />
                        <Tab value="lectures" label={DASH_ADMIN.SUBTAB_LECTURES} />
                        <Tab value="quizzes" label={DASH_ADMIN.SUBTAB_QUIZZES} />
                        <Tab value="schedule" label={DASH_ADMIN.CLASS_TAB_SCHEDULE} />
                      </Tabs>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: { xs: 'none', md: 'min(70vh, 560px)' }, overflow: 'auto' }}>
                      {classDetailSubTab === 'students' && (
                        <Stack spacing={2}>
                          <Typography variant="subtitle2" color="text.secondary">
                            {DASH_ADMIN.CLASS_STUDENTS_TITLE}
                          </Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                            <TextField
                              size="small"
                              label={DASH_ADMIN.CLASS_ADD_STUDENT_EMAIL}
                              value={classStudentEmail}
                              onChange={(e) => setClassStudentEmail(e.target.value)}
                              fullWidth
                            />
                            <Button variant="contained" onClick={() => void addStudentToClassByEmail()}>
                              {DASH_ADMIN.BTN_ADD_TO_CLASS}
                            </Button>
                          </Stack>
                          <AdminDataTable>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_NAME}</TableCell>
                                <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_EMAIL}</TableCell>
                                <TableCell align="right" sx={adminHeaderCellSx}>
                                  {DASH_ADMIN.TH_ACTIONS}
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {classStudents.map((r) => (
                                <TableRow key={r.id} sx={adminBodyRowSx}>
                                  <TableCell>{r.profiles?.full_name || '—'}</TableCell>
                                  <TableCell>{r.profiles?.email || '—'}</TableCell>
                                  <TableCell align="right">
                                    <Button
                                      type="button"
                                      color="error"
                                      size="small"
                                      onClick={() => void removeStudentFromClass(r.student_id)}
                                    >
                                      {COMMON.DELETE}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </AdminDataTable>
                        </Stack>
                      )}

                      {classDetailSubTab === 'teacher' && (
                        <Stack spacing={2} sx={{ maxWidth: 480 }}>
                          <Typography variant="body2" color="text.secondary">
                            {DASH_ADMIN.CLASS_TEACHER}
                          </Typography>
                          <FormControl size="small" fullWidth>
                            <InputLabel id="class-detail-teacher-inline">{DASH_ADMIN.CLASS_TEACHER}</InputLabel>
                            <Select
                              labelId="class-detail-teacher-inline"
                              label={DASH_ADMIN.CLASS_TEACHER}
                              value={detailTeacherId}
                              onChange={(e) => setDetailTeacherId(e.target.value)}
                            >
                              {teacherOptions.map((t) => (
                                <MenuItem key={t.id} value={t.id}>
                                  {t.full_name || t.email || t.id}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <Button variant="contained" size="medium" onClick={() => void saveDetailClassTeacher()} disabled={!detailTeacherId}>
                            {COMMON.SAVE}
                          </Button>
                        </Stack>
                      )}

                      {classDetailSubTab === 'lectures' && (
                        <Stack spacing={2}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<ListVideo size={18} />}
                            onClick={openClassDetailLectureCreate}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            {DASH_TEACHER.BTN_ADD_LECTURE}
                          </Button>
                          {detailClassLecturesLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                              <CircularProgress size={32} />
                            </Box>
                          ) : (
                            <AdminDataTable>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.LECTURE_TITLE}</TableCell>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CLASS_LECTURE_SORT}</TableCell>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.LABEL_PUBLISHED}</TableCell>
                                  <TableCell align="right" sx={adminHeaderCellSx}>
                                    {DASH_ADMIN.TH_ACTIONS}
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {detailClassLectures.map((lec) => (
                                  <TableRow key={lec.id} sx={adminBodyRowSx}>
                                    <TableCell sx={{ fontWeight: 600 }}>{lec.title}</TableCell>
                                    <TableCell>{lec.sort_order ?? 0}</TableCell>
                                    <TableCell>
                                      {lec.published ? (
                                        <Chip label={DASH_ADMIN.STATUS_PUBLISHED} color="success" size="small" sx={{ fontWeight: 700 }} />
                                      ) : (
                                        <Chip label={DASH_ADMIN.STATUS_DRAFT} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                        <Button type="button" size="small" onClick={() => openClassDetailLectureEdit(lec)}>
                                          {DASH_ADMIN.BTN_EDIT}
                                        </Button>
                                        <Button type="button" size="small" color="error" onClick={() => void deleteClassDetailLecture(lec.id)}>
                                          {COMMON.DELETE}
                                        </Button>
                                      </Stack>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </AdminDataTable>
                          )}
                        </Stack>
                      )}

                      {classDetailSubTab === 'quizzes' && (
                        <Stack spacing={2}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<ListChecks size={18} />}
                            onClick={openClassDetailQuizCreate}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            {DASH_TEACHER.BTN_ADD_QUIZ}
                          </Button>
                          {detailClassQuizzesLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                              <CircularProgress size={32} />
                            </Box>
                          ) : (
                            <AdminDataTable>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.QUIZ_TITLE}</TableCell>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.QUIZ_COL_QUESTIONS}</TableCell>
                                  <TableCell align="right" sx={adminHeaderCellSx}>
                                    {DASH_ADMIN.TH_ACTIONS}
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {detailClassQuizzes.map((q) => {
                                  const nq = Array.isArray(q.questions) ? q.questions.length : 0;
                                  return (
                                    <TableRow key={q.id} sx={adminBodyRowSx}>
                                      <TableCell sx={{ fontWeight: 600 }}>{q.title}</TableCell>
                                      <TableCell>{nq}</TableCell>
                                      <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                          <Button type="button" size="small" onClick={() => openClassDetailQuizEdit(q)}>
                                            {DASH_ADMIN.BTN_EDIT}
                                          </Button>
                                          <Button type="button" size="small" color="error" onClick={() => void deleteClassDetailQuiz(q.id)}>
                                            {COMMON.DELETE}
                                          </Button>
                                        </Stack>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </AdminDataTable>
                          )}
                        </Stack>
                      )}

                      {classDetailSubTab === 'schedule' && (
                        <Stack spacing={2}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={openClassDetailSchCreate}
                            sx={{ alignSelf: 'flex-start' }}
                          >
                            {DASH_TEACHER.BTN_ADD_SCHEDULE}
                          </Button>
                          {detailClassSchedulesLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                              <CircularProgress size={32} />
                            </Box>
                          ) : (
                            <AdminDataTable>
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_TEACHER.SCHEDULE_TITLE}</TableCell>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_TEACHER.SCHEDULE_START}</TableCell>
                                  <TableCell sx={adminHeaderCellSx}>{DASH_TEACHER.SCHEDULE_LOCATION}</TableCell>
                                  <TableCell align="right" sx={adminHeaderCellSx}>
                                    {DASH_ADMIN.TH_ACTIONS}
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {detailClassSchedules.map((s) => (
                                  <TableRow key={s.id} sx={adminBodyRowSx}>
                                    <TableCell sx={{ fontWeight: 600 }}>{s.title}</TableCell>
                                    <TableCell>
                                      {s.starts_at
                                        ? new Date(s.starts_at).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
                                        : '—'}
                                    </TableCell>
                                    <TableCell>{s.location || '—'}</TableCell>
                                    <TableCell align="right">
                                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                        <Button type="button" size="small" onClick={() => openClassDetailSchEdit(s)}>
                                          {DASH_ADMIN.BTN_EDIT}
                                        </Button>
                                        <Button type="button" size="small" color="error" onClick={() => void deleteClassDetailSchedule(s.id)}>
                                          {COMMON.DELETE}
                                        </Button>
                                      </Stack>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </AdminDataTable>
                          )}
                        </Stack>
                      )}
                    </Box>
                  </AdminSectionCard>
                )}
              </Stack>
            )}

            {tab === 'courses' && (
              <>
                <Tabs
                  value={courseArea}
                  onChange={(_, v) => setCourseArea(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    mb: 2.5,
                    minHeight: 48,
                    borderBottom: 1,
                    borderColor: 'divider',
                    '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.875rem' },
                  }}
                >
                  <Tab value="overview" label={DASH_ADMIN.COURSE_AREA_OVERVIEW} />
                  <Tab value="enrollments" label={DASH_ADMIN.TABS.enrollments} />
                  <Tab value="quiz_stats" label={DASH_ADMIN.TABS.quiz_stats} />
                </Tabs>
                {courseArea === 'overview' && (
              <Stack spacing={2.5}>
                <AdminSectionCard title={DASH_ADMIN.COURSE_STATS_SECTION}>
                  {contentStatsLoading && !contentStats ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress />
                    </Box>
                  ) : contentStats?.summary ? (
                    <>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.COURSE_STATS_TOTAL_COURSES}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contentStats.summary.totalCourses}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.COURSE_STATS_PUBLISHED_COUNT}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contentStats.summary.publishedCourses}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.COURSE_STATS_LECTURES}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contentStats.summary.totalLectures}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.COURSE_STATS_QUIZZES}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contentStats.summary.totalQuizzes}
                          </Typography>
                        </Paper>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          minHeight: 280,
                          mb: 2,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.COURSE_CHART_PUBLISH}
                          </Typography>
                          <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={coursePublishBars} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Bar dataKey="count" name={DASH_ADMIN.USER_CHART_LEGEND_COUNT} fill={chartPrimary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.COURSE_CHART_ACTIVITY_30D}
                          </Typography>
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart
                              data={contentStats.timeline || []}
                              margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="courses"
                                name={DASH_ADMIN.COURSE_CHART_LINE_NEW_COURSES}
                                stroke={chartPrimary}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="lectures"
                                name={DASH_ADMIN.COURSE_CHART_LINE_NEW_LECTURES}
                                stroke={chartSecondary}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                              />
                              <Line
                                type="monotone"
                                dataKey="quizzes"
                                name={DASH_ADMIN.COURSE_CHART_LINE_NEW_QUIZZES}
                                stroke={chartAccent}
                                strokeWidth={2}
                                dot={{ r: 2 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Box>
                      {courseTopByContent.length > 0 ? (
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.COURSE_CHART_TOP_CONTENT}
                          </Typography>
                          <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={courseTopByContent} margin={{ top: 8, right: 12, left: 0, bottom: 56 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={56} tick={{ fontSize: 10 }} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Legend />
                              <Bar
                                dataKey="lectures"
                                name={DASH_ADMIN.SUBTAB_LECTURES}
                                fill={chartPrimary}
                                radius={[4, 4, 0, 0]}
                              />
                              <Bar
                                dataKey="quizzes"
                                name={DASH_ADMIN.SUBTAB_QUIZZES}
                                fill={chartAccent}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                      ) : null}
                    </>
                  ) : (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      {ERR.LOAD_FAILED}
                    </Typography>
                  )}
                </AdminSectionCard>

                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
                  {DASH_ADMIN.LEAD_COURSES}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  value={courseMainPanel}
                  onChange={(_, v) => v != null && setCourseMainPanel(v)}
                  sx={{
                    '& .MuiToggleButton-root': { py: 1.25, fontWeight: 700, textTransform: 'none' },
                  }}
                >
                  <ToggleButton value="catalog">{DASH_ADMIN.COURSE_VIEW_CATALOG}</ToggleButton>
                  <ToggleButton value="content">{DASH_ADMIN.COURSE_VIEW_CONTENT}</ToggleButton>
                </ToggleButtonGroup>

                {courseMainPanel === 'catalog' && (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(300px, 400px)' },
                      gap: 2.5,
                      alignItems: 'start',
                    }}
                  >
                    <AdminSectionCard title={DASH_ADMIN.SECTION_COURSE_LIST}>
                      <Box
                        sx={{
                          maxHeight: { xs: 360, lg: 'min(58vh, 520px)' },
                          overflow: 'auto',
                        }}
                      >
                        <AdminDataTable>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_COURSE_TITLE}</TableCell>
                              <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_COURSE_PUBLISHED}</TableCell>
                              <TableCell align="right" sx={adminHeaderCellSx}>
                                {DASH_ADMIN.TH_ACTIONS}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {courses.map((c) => (
                              <TableRow key={c.id} sx={adminBodyRowSx}>
                                <TableCell sx={{ fontWeight: 600 }}>{c.title}</TableCell>
                                <TableCell>
                                  {c.published ? (
                                    <Chip label={DASH_ADMIN.STATUS_PUBLISHED} color="success" size="small" sx={{ fontWeight: 700 }} />
                                  ) : (
                                    <Chip label={DASH_ADMIN.STATUS_DRAFT} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                  )}
                                </TableCell>
                                <TableCell align="right">
                                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                    <Tooltip title={DASH_ADMIN.EDIT_TOOLTIP}>
                                      <IconButton
                                        type="button"
                                        color="primary"
                                        size="small"
                                        onClick={() => openEditCourse(c)}
                                        aria-label={DASH_ADMIN.EDIT_TOOLTIP}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                      <IconButton
                                        type="button"
                                        color="error"
                                        size="small"
                                        onClick={() => deleteCourse(c.id)}
                                        aria-label={DASH_ADMIN.DELETE_TOOLTIP}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </IconButton>
                                    </Tooltip>
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </AdminDataTable>
                        <AdminListPagination
                          page={coursePage}
                          pageSize={coursePageSize}
                          total={courseTotal}
                          onPageChange={(_, p) => setCoursePage(p)}
                          onPageSizeChange={(e) => {
                            setCoursePageSize(parseInt(e.target.value, 10));
                            setCoursePage(0);
                          }}
                          labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                          labelDisplayedRows={({ from, to, count }) =>
                            count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                          }
                          sx={{ borderTop: 1, borderColor: 'divider' }}
                        />
                      </Box>
                    </AdminSectionCard>

                    <Box
                      sx={{
                        position: { lg: 'sticky' },
                        top: { lg: 88 },
                        alignSelf: 'start',
                        minWidth: 0,
                      }}
                    >
                      <AdminSectionCard title={DASH_ADMIN.SECTION_ADD_COURSE}>
                        <Box
                          component="form"
                          onSubmit={addCourse}
                          sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: '1fr' }}
                        >
                          <TextField
                            size="small"
                            label={DASH_ADMIN.LABEL_COURSE_TITLE}
                            required
                            value={courseForm.title}
                            onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
                          />
                          <TextField
                            size="small"
                            label={DASH_ADMIN.LABEL_COURSE_DESC}
                            multiline
                            rows={2}
                            value={courseForm.description}
                            onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
                          />
                          <FormControl size="small" fullWidth>
                            <InputLabel id="cat-select">{DASH_ADMIN.LABEL_CATEGORY}</InputLabel>
                            <Select
                              labelId="cat-select"
                              label={DASH_ADMIN.LABEL_CATEGORY}
                              value={courseForm.category_id}
                              onChange={(e) => setCourseForm((f) => ({ ...f, category_id: e.target.value }))}
                            >
                              <MenuItem value="">—</MenuItem>
                              {categories.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                  {c.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          <TextField
                            size="small"
                            label={DASH_ADMIN.LABEL_THUMB}
                            value={courseForm.thumbnail_url}
                            onChange={(e) => setCourseForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
                          />
                          <Box sx={{ display: 'grid', gap: 1.75, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                            <TextField
                              size="small"
                              label={DASH_ADMIN.LABEL_DURATION_H}
                              value={courseForm.duration_hours}
                              onChange={(e) => setCourseForm((f) => ({ ...f, duration_hours: e.target.value }))}
                            />
                            <TextField
                              size="small"
                              label={DASH_ADMIN.LABEL_LEVEL}
                              value={courseForm.level}
                              onChange={(e) => setCourseForm((f) => ({ ...f, level: e.target.value }))}
                            />
                          </Box>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={courseForm.published}
                                onChange={(e) => setCourseForm((f) => ({ ...f, published: e.target.checked }))}
                                color="primary"
                              />
                            }
                            label={DASH_ADMIN.LABEL_PUBLISHED}
                          />
                          <Button type="submit" variant="contained" color="primary" size="medium" startIcon={<PlusCircle size={18} />}>
                            {DASH_ADMIN.ADD_COURSE}
                          </Button>
                        </Box>
                      </AdminSectionCard>
                    </Box>
                  </Box>
                )}

                {courseMainPanel === 'content' && (
                  <AdminSectionCard title={DASH_ADMIN.COURSE_CONTENT}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                      <FormControl size="small" sx={{ minWidth: 0, flex: 1, maxWidth: { sm: 480 } }} fullWidth>
                        <InputLabel id="pick-course">{DASH_ADMIN.PICK_COURSE}</InputLabel>
                        <Select
                          labelId="pick-course"
                          label={DASH_ADMIN.PICK_COURSE}
                          value={selectedCourseId}
                          onChange={(e) => setSelectedCourseId(e.target.value)}
                          disabled={courseOptions.length === 0}
                        >
                          {courseOptions.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.title}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>

                    {selectedCourseId ? (
                      <>
                        <Paper elevation={0} sx={{ borderRadius: 2, overflow: 'hidden', mb: 2 }}>
                          <Tabs
                            value={courseSubTab}
                            onChange={(_, v) => setCourseSubTab(v)}
                            sx={{
                              bgcolor: 'action.hover',
                              minHeight: 48,
                              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, minHeight: 48 },
                            }}
                            TabIndicatorProps={{ sx: { bgcolor: 'primary.main', height: 3 } }}
                          >
                            <Tab value="lectures" label={DASH_ADMIN.SUBTAB_LECTURES} />
                            <Tab value="quizzes" label={DASH_ADMIN.SUBTAB_QUIZZES} />
                          </Tabs>
                        </Paper>

                        {courseSubTab === 'lectures' && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Accordion
                              defaultExpanded={false}
                              disableGutters
                              elevation={0}
                              sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
                            >
                              <AccordionSummary expandIcon={<ChevronDown size={20} />} sx={{ fontWeight: 700, minHeight: 48 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {DASH_ADMIN.FORM_ADD_LECTURE}
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails sx={{ pt: 0 }}>
                                <Paper
                                  component="form"
                                  variant="outlined"
                                  onSubmit={addLecture}
                                  sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
                                >
                                  <TextField
                                    size="small"
                                    label={DASH_ADMIN.LECTURE_TITLE}
                                    required
                                    value={lectureForm.title}
                                    onChange={(e) => setLectureForm((f) => ({ ...f, title: e.target.value }))}
                                  />
                                  <AdminLectureBlocksEditor
                                    blocks={lectureForm.blocks}
                                    onBlocksChange={(next) => setLectureForm((f) => ({ ...f, blocks: next }))}
                                  />
                                  <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    size="medium"
                                    startIcon={<ListVideo size={18} />}
                                    sx={{ alignSelf: 'flex-start' }}
                                  >
                                    {DASH_ADMIN.ADD_LECTURE}
                                  </Button>
                                </Paper>
                              </AccordionDetails>
                            </Accordion>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 0.5 }}>
                              {DASH_ADMIN.TH_LECTURE_TITLE}
                            </Typography>
                            <Box sx={{ maxHeight: { xs: 320, md: 400 }, overflow: 'auto' }}>
                              <AdminDataTable>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_LECTURE_TITLE}</TableCell>
                                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_LECTURE_BLOCKS}</TableCell>
                                    <TableCell align="right" sx={adminHeaderCellSx}>
                                      {DASH_ADMIN.TH_ACTIONS}
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {lectures.map((lec) => (
                                    <TableRow key={lec.id} sx={adminBodyRowSx}>
                                      <TableCell>{lec.title}</TableCell>
                                      <TableCell>{countLectureBlocks(lec)}</TableCell>
                                      <TableCell align="right">
                                        <Tooltip title={DASH_ADMIN.EDIT_TOOLTIP}>
                                          <IconButton
                                            type="button"
                                            color="primary"
                                            size="small"
                                            onClick={() => openEditLecture(lec)}
                                            aria-label={DASH_ADMIN.EDIT_TOOLTIP}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </IconButton>
                                        </Tooltip>
                                        <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                          <IconButton
                                            type="button"
                                            color="error"
                                            size="small"
                                            onClick={() => deleteLecture(lec.id)}
                                            aria-label={DASH_ADMIN.DELETE_TOOLTIP}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </IconButton>
                                        </Tooltip>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </AdminDataTable>
                            </Box>
                            <AdminListPagination
                              page={lecturePage}
                              pageSize={lecturePageSize}
                              total={lectureTotal}
                              onPageChange={(_, p) => setLecturePage(p)}
                              onPageSizeChange={(e) => {
                                setLecturePageSize(parseInt(e.target.value, 10));
                                setLecturePage(0);
                              }}
                              labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                              labelDisplayedRows={({ from, to, count }) =>
                                count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                              }
                              sx={{ borderTop: 1, borderColor: 'divider' }}
                            />
                          </Box>
                        )}

                        {courseSubTab === 'quizzes' && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Accordion
                              defaultExpanded={false}
                              disableGutters
                              elevation={0}
                              sx={{ border: 1, borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
                            >
                              <AccordionSummary expandIcon={<ChevronDown size={20} />} sx={{ fontWeight: 700, minHeight: 48 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                  {DASH_ADMIN.FORM_ADD_QUIZ}
                                </Typography>
                              </AccordionSummary>
                              <AccordionDetails sx={{ pt: 0 }}>
                                <Paper
                                  component="form"
                                  variant="outlined"
                                  onSubmit={addQuiz}
                                  sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}
                                >
                                  <TextField
                                    size="small"
                                    label={DASH_ADMIN.QUIZ_TITLE}
                                    required
                                    value={quizForm.title}
                                    onChange={(e) => setQuizForm((f) => ({ ...f, title: e.target.value }))}
                                  />
                                  <TextField
                                    size="small"
                                    label={DASH_ADMIN.QUIZ_DESC}
                                    value={quizForm.description}
                                    onChange={(e) => setQuizForm((f) => ({ ...f, description: e.target.value }))}
                                  />
                                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {DASH_ADMIN.QUIZ_QUESTIONS_SECTION}
                                  </Typography>
                                  {quizForm.questions.map((row, qIdx) => (
                                    <Paper
                                      key={row._id}
                                      variant="outlined"
                                      sx={{ p: 2, pt: quizForm.questions.length > 1 ? 4 : 2, position: 'relative' }}
                                    >
                                      {quizForm.questions.length > 1 ? (
                                        <IconButton
                                          type="button"
                                          size="small"
                                          aria-label={DASH_ADMIN.REMOVE_QUIZ_QUESTION}
                                          onClick={() =>
                                            setQuizForm((f) => ({
                                              ...f,
                                              questions: f.questions.filter((_, i) => i !== qIdx),
                                            }))
                                          }
                                          sx={{ position: 'absolute', top: 8, right: 8 }}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </IconButton>
                                      ) : null}
                                      <Stack spacing={1.5}>
                                        <TextField
                                          size="small"
                                          label={`${qIdx + 1}. ${DASH_ADMIN.QUIZ_QUESTION_TEXT}`}
                                          required
                                          value={row.question}
                                          onChange={(e) => {
                                            const next = [...quizForm.questions];
                                            next[qIdx] = { ...next[qIdx], question: e.target.value };
                                            setQuizForm((f) => ({ ...f, questions: next }));
                                          }}
                                        />
                                        <TextField
                                          size="small"
                                          label={DASH_ADMIN.QUIZ_OPTION_A}
                                          value={row.a}
                                          onChange={(e) => {
                                            const next = [...quizForm.questions];
                                            next[qIdx] = { ...next[qIdx], a: e.target.value };
                                            setQuizForm((f) => ({ ...f, questions: next }));
                                          }}
                                        />
                                        <TextField
                                          size="small"
                                          label={DASH_ADMIN.QUIZ_OPTION_B}
                                          value={row.b}
                                          onChange={(e) => {
                                            const next = [...quizForm.questions];
                                            next[qIdx] = { ...next[qIdx], b: e.target.value };
                                            setQuizForm((f) => ({ ...f, questions: next }));
                                          }}
                                        />
                                        <TextField
                                          size="small"
                                          label={DASH_ADMIN.QUIZ_OPTION_C}
                                          value={row.c}
                                          onChange={(e) => {
                                            const next = [...quizForm.questions];
                                            next[qIdx] = { ...next[qIdx], c: e.target.value };
                                            setQuizForm((f) => ({ ...f, questions: next }));
                                          }}
                                        />
                                        <TextField
                                          size="small"
                                          label={DASH_ADMIN.QUIZ_OPTION_D}
                                          value={row.d}
                                          onChange={(e) => {
                                            const next = [...quizForm.questions];
                                            next[qIdx] = { ...next[qIdx], d: e.target.value };
                                            setQuizForm((f) => ({ ...f, questions: next }));
                                          }}
                                        />
                                        <FormControl component="fieldset" variant="standard">
                                          <Typography component="legend" variant="caption" sx={{ mb: 0.5, fontWeight: 600 }}>
                                            {DASH_ADMIN.QUIZ_CORRECT}
                                          </Typography>
                                          <RadioGroup
                                            row
                                            value={String(row.correct)}
                                            onChange={(e) => {
                                              const next = [...quizForm.questions];
                                              next[qIdx] = { ...next[qIdx], correct: Number(e.target.value) };
                                              setQuizForm((f) => ({ ...f, questions: next }));
                                            }}
                                          >
                                            {['A', 'B', 'C', 'D'].map((lab, oi) => (
                                              <FormControlLabel key={lab} value={String(oi)} control={<Radio size="small" />} label={lab} />
                                            ))}
                                          </RadioGroup>
                                        </FormControl>
                                      </Stack>
                                    </Paper>
                                  ))}
                                  <Button
                                    type="button"
                                    variant="outlined"
                                    size="small"
                                    sx={{ alignSelf: 'flex-start' }}
                                    onClick={() => setQuizForm((f) => ({ ...f, questions: [...f.questions, newQuizQuestion()] }))}
                                  >
                                    {DASH_ADMIN.ADD_QUIZ_QUESTION}
                                  </Button>
                                  <Button
                                    type="submit"
                                    variant="contained"
                                    color="primary"
                                    size="medium"
                                    startIcon={<ListChecks size={18} />}
                                    sx={{ alignSelf: 'flex-start' }}
                                  >
                                    {DASH_ADMIN.ADD_QUIZ}
                                  </Button>
                                </Paper>
                              </AccordionDetails>
                            </Accordion>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {DASH_ADMIN.TH_QUIZ_TITLE}
                            </Typography>
                            <Box sx={{ maxHeight: { xs: 320, md: 400 }, overflow: 'auto' }}>
                              <AdminDataTable>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_QUIZ_TITLE}</TableCell>
                                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.QUIZ_DESC}</TableCell>
                                    <TableCell align="right" sx={adminHeaderCellSx} />
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {quizzes.map((q) => (
                                    <TableRow key={q.id} sx={adminBodyRowSx}>
                                      <TableCell sx={{ fontWeight: 600 }}>{q.title}</TableCell>
                                      <TableCell sx={{ maxWidth: 280 }}>
                                        <Typography variant="body2" color="text.secondary" noWrap title={q.description || ''}>
                                          {q.description || '—'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">
                                        <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                          <IconButton
                                            type="button"
                                            color="error"
                                            size="small"
                                            onClick={() => deleteQuiz(q.id)}
                                            aria-label={DASH_ADMIN.DELETE_TOOLTIP}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </IconButton>
                                        </Tooltip>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </AdminDataTable>
                            </Box>
                            <AdminListPagination
                              page={quizListPage}
                              pageSize={quizListPageSize}
                              total={quizListTotal}
                              onPageChange={(_, p) => setQuizListPage(p)}
                              onPageSizeChange={(e) => {
                                setQuizListPageSize(parseInt(e.target.value, 10));
                                setQuizListPage(0);
                              }}
                              labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                              labelDisplayedRows={({ from, to, count }) =>
                                count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                              }
                              sx={{ borderTop: 1, borderColor: 'divider' }}
                            />
                          </Box>
                        )}
                      </>
                    ) : (
                      <Typography color="text.secondary">{DASH_ADMIN.PICK_COURSE}</Typography>
                    )}
                  </AdminSectionCard>
                )}
              </Stack>
                )}

                {courseArea === 'quiz_stats' && (
              <Stack spacing={3}>
                <AdminSectionCard overline={DASH_ADMIN.LEAD_QUIZ_ANALYTICS} title={DASH_ADMIN.TABS.quiz_stats}>
                  {quizStatsLoading && quizAnSummary == null ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                      <CircularProgress />
                    </Box>
                  ) : (quizAnSummary?.summary?.totalAttempts ?? 0) === 0 ? (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                      {DASH_ADMIN.QUIZ_ANALYTICS_EMPTY}
                    </Typography>
                  ) : (
                    <>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.QUIZ_ANALYTICS_SUMMARY_ATTEMPTS}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {quizAnalytics.summary?.totalAttempts ?? 0}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.QUIZ_ANALYTICS_SUMMARY_AVG}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {quizAnalytics.summary?.avgPercent ?? 0}%
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.QUIZ_ANALYTICS_SUMMARY_STUDENTS}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {quizAnalytics.summary?.distinctStudents ?? 0}
                          </Typography>
                        </Paper>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          minHeight: 280,
                          mb: 2,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.QUIZ_ANALYTICS_CHART_COURSE}
                          </Typography>
                          <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart
                              data={(quizAnalytics.stats?.byCourse || []).map((c) => ({
                                name:
                                  (c.title || c.slug || '').length > 22
                                    ? `${String(c.title || c.slug).slice(0, 20)}\u2026`
                                    : c.title || c.slug || '\u2014',
                                attempts: c.attempts,
                                avgPercent: c.avgPercent,
                              }))}
                              margin={{ top: 8, right: 12, left: 0, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={56} tick={{ fontSize: 11 }} />
                              <YAxis yAxisId="left" allowDecimals={false} width={36} />
                              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} width={40} />
                              <RechartsTooltip />
                              <Legend />
                              <Bar yAxisId="left" dataKey="attempts" name={DASH_ADMIN.CHART_ATTEMPTS} fill={chartPrimary} radius={[4, 4, 0, 0]} />
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="avgPercent"
                                name={DASH_ADMIN.CHART_AVG_SUFFIX}
                                stroke={chartSecondary}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                              />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.QUIZ_ANALYTICS_CHART_TIMELINE}
                          </Typography>
                          <ResponsiveContainer width="100%" height={280}>
                            <LineChart data={quizAnalytics.stats?.byDay || []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Line type="monotone" dataKey="count" name={DASH_ADMIN.CHART_ATTEMPTS} stroke={chartSecondary} strokeWidth={2} dot />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Box>
                      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper', mb: 2 }}>
                        <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                          {DASH_ADMIN.QUIZ_ANALYTICS_CHART_SCORE}
                        </Typography>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={quizAnalytics.stats?.byScoreBand || []} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                            <YAxis allowDecimals={false} width={36} />
                            <RechartsTooltip />
                            <Bar dataKey="count" name={DASH_ADMIN.CHART_ATTEMPTS} fill={chartAccent} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Paper>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
                        {DASH_ADMIN.QUIZ_ANALYTICS_TABLE_TITLE}
                      </Typography>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_COURSE}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_QUIZ_TITLE}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_STUDENT}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_EMAIL}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.QUIZ_ANAL_TH_SCORE}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_DATE}</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(quizAnItems || []).map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell sx={{ fontWeight: 600 }}>{row.course_title || '\u2014'}</TableCell>
                              <TableCell>{row.quiz_title || '\u2014'}</TableCell>
                              <TableCell>{row.student_name || '\u2014'}</TableCell>
                              <TableCell>{row.student_email || '\u2014'}</TableCell>
                              <TableCell>
                                {row.correct}/{row.total} ({row.percent}%)
                              </TableCell>
                              <TableCell>{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : '\u2014'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                      <AdminListPagination
                        page={quizAnPage}
                        pageSize={quizAnPageSize}
                        total={quizAnTotal}
                        onPageChange={(_, p) => setQuizAnPage(p)}
                        onPageSizeChange={(e) => {
                          setQuizAnPageSize(parseInt(e.target.value, 10));
                          setQuizAnPage(0);
                        }}
                        labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                        labelDisplayedRows={({ from, to, count }) =>
                          count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                        }
                        sx={{ borderTop: 1, borderColor: 'divider' }}
                      />
                    </>
                  )}
                </AdminSectionCard>
              </Stack>
                )}

                {courseArea === 'enrollments' && (
              <Stack spacing={3}>
                <AdminSectionCard overline={DASH_ADMIN.LEAD_ENROLLMENTS} title={DASH_ADMIN.TABS.enrollments}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 2,
                  minHeight: 280,
                  mb: 2,
                }}
              >
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                    {DASH_ADMIN.ENROLL_STATS_TITLE}
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={(enrollReport?.stats?.byCourse || []).map((c) => ({
                        name:
                          (c.title || c.slug || '').length > 22
                            ? `${String(c.title || c.slug).slice(0, 20)}\u2026`
                            : c.title || c.slug || '\u2014',
                        count: c.count,
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-28} textAnchor="end" height={56} tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} width={36} />
                      <RechartsTooltip />
                      <Bar dataKey="count" name={DASH_ADMIN.CHART_STUDENTS} fill={chartPrimary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Paper>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                  <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                    {DASH_ADMIN.ENROLL_TIMELINE_TITLE}
                  </Typography>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={enrollReport?.stats?.byDay || []} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                      <YAxis allowDecimals={false} width={36} />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="count" name={DASH_ADMIN.CHART_STUDENTS} stroke={chartSecondary} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </Paper>
              </Box>

              <FormControl size="small" sx={{ maxWidth: 400, width: '100%', mb: 2 }}>
                <InputLabel id="enroll-filter-course">{DASH_ADMIN.ENROLL_FILTER_ALL}</InputLabel>
                <Select
                  labelId="enroll-filter-course"
                  label={DASH_ADMIN.ENROLL_FILTER_ALL}
                  value={enrollCourseFilter}
                  onChange={(e) => setEnrollCourseFilter(e.target.value)}
                >
                  <MenuItem value="">{DASH_ADMIN.ENROLL_FILTER_ALL}</MenuItem>
                  {courseOptions.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.title}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <AdminDataTable>
                <TableHead>
                  <TableRow>
                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_COURSE}</TableCell>
                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_STUDENT}</TableCell>
                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_EMAIL}</TableCell>
                    <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_DATE}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(enrollReport?.enrollments || []).map((row) => (
                    <TableRow key={row.id} sx={adminBodyRowSx}>
                      <TableCell sx={{ fontWeight: 600 }}>{row.courses?.title || '\u2014'}</TableCell>
                      <TableCell>{row.profiles?.full_name || '\u2014'}</TableCell>
                      <TableCell>{row.profiles?.email || '\u2014'}</TableCell>
                      <TableCell>
                        {row.enrolled_at ? new Date(row.enrolled_at).toLocaleString() : '\u2014'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
              <AdminListPagination
                page={enrollPage}
                pageSize={enrollPageSize}
                total={enrollReport?.total ?? 0}
                onPageChange={(_, p) => setEnrollPage(p)}
                onPageSizeChange={(e) => {
                  setEnrollPageSize(parseInt(e.target.value, 10));
                  setEnrollPage(0);
                }}
                labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                labelDisplayedRows={({ from, to, count }) =>
                  count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                }
                sx={{ borderTop: 1, borderColor: 'divider' }}
              />
              {(enrollReport?.total ?? 0) === 0 && enrollReport != null ? (
                <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                  {DASH_ADMIN.ENROLL_TABLE_EMPTY}
                </Typography>
              ) : null}
                </AdminSectionCard>
              </Stack>
                )}
              </>
            )}

            {tab === 'content' && (
              <Stack spacing={2.5}>
                <Typography variant="body2" color="text.secondary">
                  {DASH_ADMIN.CMS_INTRO}
                </Typography>
                <Tabs value={cmsSubTab} onChange={(_, v) => setCmsSubTab(v)} variant="scrollable" scrollButtons="auto">
                  <Tab value="team" label={DASH_ADMIN.CMS_SUBTAB_TEAM} />
                  <Tab value="testi" label={DASH_ADMIN.CMS_SUBTAB_TESTI} />
                  <Tab value="contact" label={DASH_ADMIN.CMS_SUBTAB_CONTACT} />
                </Tabs>

                {cmsSubTab === 'team' && (
                  <Stack spacing={2.5}>
                    <AdminSectionCard title={DASH_ADMIN.CMS_TEAM_STATS_SECTION}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TEAM_TOTAL}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {teamCmsAnalytics.total}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TEAM_ROLE_KINDS}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {teamCmsAnalytics.roleKinds}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TEAM_NEW_30D}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {teamCmsAnalytics.newIn30d}
                          </Typography>
                        </Paper>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          minHeight: 280,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_TEAM_CHART_ROLES}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={teamCmsAnalytics.byRole} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={56} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Bar
                                dataKey="count"
                                name={DASH_ADMIN.CMS_CHART_COUNT}
                                fill={chartPrimary}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_TEAM_CHART_TIMELINE}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart
                              data={teamCmsAnalytics.byDaySeries}
                              margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Line
                                type="monotone"
                                dataKey="count"
                                name={DASH_ADMIN.CMS_LINE_NEW_PER_DAY}
                                stroke={chartSecondary}
                                strokeWidth={2}
                                dot
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Box>
                    </AdminSectionCard>

                    <AdminSectionCard title={DASH_ADMIN.CMS_SUBTAB_TEAM}>
                      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<PlusCircle className="h-4 w-4" />} onClick={openTeamCreate}>
                          {DASH_ADMIN.CMS_ADD_TEAM}
                        </Button>
                      </Stack>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_NAME}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_ROLE}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_TH_ORDER}</TableCell>
                            <TableCell sx={adminHeaderCellSx} align="right">
                              {DASH_ADMIN.TH_ACTIONS}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cmsTeam.map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                              <TableCell>{row.role_title || '\u2014'}</TableCell>
                              <TableCell>{row.sort_order ?? 0}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" aria-label="edit" onClick={() => openTeamEdit(row)}>
                                  <Pencil className="h-4 w-4" />
                                </IconButton>
                                <IconButton size="small" aria-label="delete" color="error" onClick={() => void deleteTeamRow(row.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                      <AdminListPagination
                        page={teamPage}
                        pageSize={teamPageSize}
                        total={teamTotal}
                        onPageChange={(_, p) => setTeamPage(p)}
                        onPageSizeChange={(e) => {
                          setTeamPageSize(parseInt(e.target.value, 10));
                          setTeamPage(0);
                        }}
                        labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                        labelDisplayedRows={({ from, to, count }) =>
                          count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                        }
                        sx={{ borderTop: 1, borderColor: 'divider' }}
                      />
                      {teamTotal === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                          {TEAM_PAGE.EMPTY}
                        </Typography>
                      ) : null}
                    </AdminSectionCard>
                  </Stack>
                )}

                {cmsSubTab === 'testi' && (
                  <Stack spacing={2.5}>
                    <AdminSectionCard title={DASH_ADMIN.CMS_TESTI_STATS_SECTION}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TESTI_TOTAL}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {testiCmsAnalytics.total}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TESTI_RATED_COUNT}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {testiCmsAnalytics.nRated}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TESTI_AVG_STARS}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {testiCmsAnalytics.avgRating != null ? testiCmsAnalytics.avgRating : '—'}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TEAM_NEW_30D}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {testiCmsAnalytics.newIn30d}
                          </Typography>
                        </Paper>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          minHeight: 280,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_TESTI_CHART_RATING}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={testiCmsAnalytics.byRating} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Bar
                                dataKey="count"
                                name={DASH_ADMIN.CMS_CHART_COUNT}
                                fill={chartAccent}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_TESTI_CHART_TIMELINE}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart
                              data={testiCmsAnalytics.byDaySeries}
                              margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Line
                                type="monotone"
                                dataKey="count"
                                name={DASH_ADMIN.CMS_LINE_NEW_PER_DAY}
                                stroke={chartPrimary}
                                strokeWidth={2}
                                dot
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Box>
                    </AdminSectionCard>

                    <AdminSectionCard title={DASH_ADMIN.CMS_SUBTAB_TESTI}>
                      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
                        <Button variant="contained" size="small" startIcon={<PlusCircle className="h-4 w-4" />} onClick={openTestiCreate}>
                          {DASH_ADMIN.CMS_ADD_TESTI}
                        </Button>
                      </Stack>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_NAME}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_EMAIL}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_ROLE}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_RATING}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_TH_ORDER}</TableCell>
                            <TableCell sx={adminHeaderCellSx} align="right">
                              {DASH_ADMIN.TH_ACTIONS}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cmsTesti.map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell sx={{ fontWeight: 600 }}>{row.author_name}</TableCell>
                              <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>{row.author_email || '\u2014'}</TableCell>
                              <TableCell>{row.author_title || '\u2014'}</TableCell>
                              <TableCell>{row.rating ?? '\u2014'}</TableCell>
                              <TableCell>{row.sort_order ?? 0}</TableCell>
                              <TableCell align="right">
                                <IconButton size="small" aria-label="edit" onClick={() => openTestiEdit(row)}>
                                  <Pencil className="h-4 w-4" />
                                </IconButton>
                                <IconButton size="small" aria-label="delete" color="error" onClick={() => void deleteTestiRow(row.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                      <AdminListPagination
                        page={testiPage}
                        pageSize={testiPageSize}
                        total={testiTotal}
                        onPageChange={(_, p) => setTestiPage(p)}
                        onPageSizeChange={(e) => {
                          setTestiPageSize(parseInt(e.target.value, 10));
                          setTestiPage(0);
                        }}
                        labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                        labelDisplayedRows={({ from, to, count }) =>
                          count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                        }
                        sx={{ borderTop: 1, borderColor: 'divider' }}
                      />
                      {testiTotal === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                          {TESTI_PAGE.EMPTY}
                        </Typography>
                      ) : null}
                    </AdminSectionCard>
                  </Stack>
                )}

                {cmsSubTab === 'contact' && (
                  <Stack spacing={2.5}>
                    <AdminSectionCard title={DASH_ADMIN.CMS_CONTACT_STATS_SECTION}>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_CONTACT_TOTAL}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contactCmsAnalytics.total}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_CONTACT_HAS_SUBJECT}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contactCmsAnalytics.withSubject}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_CONTACT_NO_SUBJECT_LABEL}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contactCmsAnalytics.withoutSubject}
                          </Typography>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={700}>
                            {DASH_ADMIN.CMS_TEAM_NEW_30D}
                          </Typography>
                          <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>
                            {contactCmsAnalytics.newIn30d}
                          </Typography>
                        </Paper>
                      </Box>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                          gap: 2,
                          minHeight: 280,
                        }}
                      >
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_CONTACT_CHART_SUBJECT}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                              data={contactCmsAnalytics.bySubjectKind}
                              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Bar
                                dataKey="count"
                                name={DASH_ADMIN.CMS_CHART_COUNT}
                                fill={chartPrimary}
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </Paper>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
                          <Typography variant="subtitle1" className="font-display" sx={{ fontWeight: 800, mb: 1.5 }}>
                            {DASH_ADMIN.CMS_CONTACT_CHART_TIMELINE}
                          </Typography>
                          <ResponsiveContainer width="100%" height={260}>
                            <LineChart
                              data={contactCmsAnalytics.byDaySeries}
                              margin={{ top: 8, right: 16, left: 0, bottom: 48 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="day" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={52} />
                              <YAxis allowDecimals={false} width={36} />
                              <RechartsTooltip />
                              <Line
                                type="monotone"
                                dataKey="count"
                                name={DASH_ADMIN.CMS_LINE_NEW_PER_DAY}
                                stroke={chartSecondary}
                                strokeWidth={2}
                                dot
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Paper>
                      </Box>
                    </AdminSectionCard>

                    <AdminSectionCard title={DASH_ADMIN.CMS_SUBTAB_CONTACT}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {DASH_ADMIN.CMS_CONTACT_INTRO}
                      </Typography>
                      <AdminDataTable>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.CMS_COL_NAME}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_EMAIL}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{CONTACT_PAGE.SUBJECT}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_MSG_PREVIEW}</TableCell>
                            <TableCell sx={adminHeaderCellSx}>{DASH_ADMIN.TH_ENROLL_DATE}</TableCell>
                            <TableCell sx={adminHeaderCellSx} align="right">
                              {DASH_ADMIN.TH_ACTIONS}
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cmsContacts.map((row) => (
                            <TableRow key={row.id} sx={adminBodyRowSx}>
                              <TableCell sx={{ fontWeight: 600, maxWidth: 140 }}>{row.name || '\u2014'}</TableCell>
                              <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>{row.email || '\u2014'}</TableCell>
                              <TableCell sx={{ maxWidth: 180 }}>{row.subject || '\u2014'}</TableCell>
                              <TableCell sx={{ maxWidth: 280, verticalAlign: 'top' }}>
                                <Typography
                                  component="div"
                                  variant="body2"
                                  sx={{
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: 120,
                                    overflow: 'auto',
                                  }}
                                >
                                  {row.message || '\u2014'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {row.created_at ? new Date(row.created_at).toLocaleString('vi-VN') : '\u2014'}
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title={DASH_ADMIN.CMS_CONTACT_DETAIL}>
                                  <IconButton
                                    size="small"
                                    aria-label="view"
                                    onClick={() => {
                                      setContactViewRow(row);
                                      setContactViewOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={DASH_ADMIN.DELETE_TOOLTIP}>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label="delete"
                                    onClick={() => void deleteContactRow(row.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </AdminDataTable>
                      <AdminListPagination
                        page={contactPage}
                        pageSize={contactPageSize}
                        total={contactTotal}
                        onPageChange={(_, p) => setContactPage(p)}
                        onPageSizeChange={(e) => {
                          setContactPageSize(parseInt(e.target.value, 10));
                          setContactPage(0);
                        }}
                        labelRowsPerPage={DASH_ADMIN.TABLE_PAGINATION_LABEL_ROWS}
                        labelDisplayedRows={({ from, to, count }) =>
                          count === 0 ? '0 / 0' : `${from}–${to} / ${count !== -1 ? count : '—'}`
                        }
                        sx={{ borderTop: 1, borderColor: 'divider' }}
                      />
                      {contactTotal === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                          {DASH_ADMIN.CMS_CONTACT_EMPTY}
                        </Typography>
                      ) : null}
                    </AdminSectionCard>
                  </Stack>
                )}
              </Stack>
            )}
          </AdminShell>
        </div>
      </Box>

      <Dialog
        open={lectureEditOpen}
        onClose={() => {
          setLectureEditOpen(false);
          setLectureEditingId(null);
        }}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={submitLectureEdit}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{DASH_ADMIN.LECTURE_DIALOG_EDIT}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.LECTURE_TITLE}
            value={lectureEditForm.title}
            onChange={(e) => setLectureEditForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <AdminLectureBlocksEditor
            blocks={lectureEditForm.blocks}
            onBlocksChange={(next) => setLectureEditForm((f) => ({ ...f, blocks: next }))}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button
            type="button"
            onClick={() => {
              setLectureEditOpen(false);
              setLectureEditingId(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={courseEditOpen}
        onClose={() => setCourseEditOpen(false)}
        fullWidth
        maxWidth="sm"
        component="form"
        onSubmit={submitCourseEdit}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{DASH_ADMIN.COURSE_DIALOG_EDIT}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.LABEL_COURSE_TITLE}
            value={courseEditForm.title}
            onChange={(e) => setCourseEditForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_COURSE_DESC}
            multiline
            minRows={2}
            value={courseEditForm.description}
            onChange={(e) => setCourseEditForm((f) => ({ ...f, description: e.target.value }))}
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="course-edit-cat">{DASH_ADMIN.LABEL_CATEGORY}</InputLabel>
            <Select
              labelId="course-edit-cat"
              label={DASH_ADMIN.LABEL_CATEGORY}
              value={courseEditForm.category_id}
              onChange={(e) => setCourseEditForm((f) => ({ ...f, category_id: e.target.value }))}
            >
              <MenuItem value="">—</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_THUMB}
            value={courseEditForm.thumbnail_url}
            onChange={(e) => setCourseEditForm((f) => ({ ...f, thumbnail_url: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_DURATION_H}
            value={courseEditForm.duration_hours}
            onChange={(e) => setCourseEditForm((f) => ({ ...f, duration_hours: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_LEVEL}
            value={courseEditForm.level}
            onChange={(e) => setCourseEditForm((f) => ({ ...f, level: e.target.value }))}
            fullWidth
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={courseEditForm.published}
                onChange={(e) => setCourseEditForm((f) => ({ ...f, published: e.target.checked }))}
                color="primary"
              />
            }
            label={DASH_ADMIN.LABEL_PUBLISHED}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button type="button" onClick={() => setCourseEditOpen(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={userDialogOpen}
        onClose={() => setUserDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        component="form"
        onSubmit={submitUserForm}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{userEditingId ? DASH_ADMIN.USER_DIALOG_EDIT : DASH_ADMIN.USER_DIALOG_CREATE}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            required
            autoComplete="off"
            size="small"
            label={COMMON.EMAIL}
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
            margin="dense"
          />
          <TextField
            required={!userEditingId}
            autoComplete="new-password"
            size="small"
            label={COMMON.PASSWORD}
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
            helperText={userEditingId ? DASH_ADMIN.PW_LEAVE_BLANK : undefined}
            margin="dense"
          />
          <TextField
            size="small"
            label={DASH_ADMIN.TH_NAME}
            value={userForm.full_name}
            onChange={(e) => setUserForm((f) => ({ ...f, full_name: e.target.value }))}
            margin="dense"
          />
          <FormControl size="small" margin="dense" sx={{ minWidth: 200 }}>
            <InputLabel id="user-form-role">{DASH_ADMIN.TH_ROLE}</InputLabel>
            <Select
              labelId="user-form-role"
              label={DASH_ADMIN.TH_ROLE}
              value={userForm.role}
              onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
            >
              <MenuItem value="student">{DASH_ADMIN.ROLE_STUDENT}</MenuItem>
              <MenuItem value="teacher">{DASH_ADMIN.ROLE_TEACHER}</MenuItem>
              <MenuItem value="admin">{DASH_ADMIN.ROLE_ADMIN}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button type="button" onClick={() => setUserDialogOpen(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={classDialogOpen}
        onClose={() => setClassDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        component="form"
        onSubmit={submitClassForm}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {classEditingId ? DASH_ADMIN.CLASS_DIALOG_EDIT : DASH_ADMIN.CLASS_DIALOG_CREATE}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.CLASS_NAME}
            value={classForm.name}
            onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.TH_COURSE_SLUG}
            value={classForm.slug}
            onChange={(e) => setClassForm((f) => ({ ...f, slug: e.target.value }))}
            helperText={DASH_ADMIN.CLASS_SLUG_HINT}
            disabled={Boolean(classEditingId)}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_COURSE_DESC}
            value={classForm.description}
            onChange={(e) => setClassForm((f) => ({ ...f, description: e.target.value }))}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.CLASS_IMAGE_URL}
            value={classForm.image_url}
            onChange={(e) => setClassForm((f) => ({ ...f, image_url: e.target.value }))}
            helperText={DASH_ADMIN.CLASS_IMAGE_HINT}
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel id="class-form-teacher">{DASH_ADMIN.CLASS_TEACHER}</InputLabel>
            <Select
              labelId="class-form-teacher"
              label={DASH_ADMIN.CLASS_TEACHER}
              value={classForm.teacher_id}
              onChange={(e) => setClassForm((f) => ({ ...f, teacher_id: e.target.value }))}
            >
              {teacherOptions.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.full_name || t.email || t.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel id="class-form-status">{DASH_ADMIN.CLASS_STATUS}</InputLabel>
            <Select
              labelId="class-form-status"
              label={DASH_ADMIN.CLASS_STATUS}
              value={classForm.status}
              onChange={(e) => setClassForm((f) => ({ ...f, status: e.target.value }))}
            >
              <MenuItem value="active">{DASH_ADMIN.CLASS_STATUS_ACTIVE}</MenuItem>
              <MenuItem value="archived">{DASH_ADMIN.CLASS_STATUS_ARCHIVED}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button type="button" onClick={() => setClassDialogOpen(false)}>
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={classDetailLecOpen}
        onClose={() => {
          setClassDetailLecOpen(false);
          setClassDetailLecEditing(null);
        }}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={submitClassDetailLecture}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {classDetailLecEditing ? DASH_ADMIN.LECTURE_DIALOG_EDIT : DASH_ADMIN.LECTURE_DIALOG_ADD}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.LECTURE_TITLE}
            value={classDetailLecForm.title}
            onChange={(e) => setClassDetailLecForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              size="small"
              type="number"
              label={DASH_ADMIN.CLASS_LECTURE_SORT}
              value={classDetailLecForm.sort_order}
              onChange={(e) => setClassDetailLecForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={classDetailLecForm.published}
                  onChange={(e) => setClassDetailLecForm((f) => ({ ...f, published: e.target.checked }))}
                />
              }
              label={DASH_ADMIN.CLASS_LECTURE_PUBLISHED}
            />
          </Stack>
          <AdminLectureBlocksEditor
            blocks={classDetailLecForm.blocks}
            onBlocksChange={(next) => setClassDetailLecForm((f) => ({ ...f, blocks: next }))}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button
            type="button"
            onClick={() => {
              setClassDetailLecOpen(false);
              setClassDetailLecEditing(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={classDetailQuizOpen}
        onClose={() => {
          setClassDetailQuizOpen(false);
          setClassDetailQuizEditing(null);
        }}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={submitClassDetailQuiz}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {classDetailQuizEditing ? DASH_ADMIN.QUIZ_DIALOG_EDIT : DASH_ADMIN.QUIZ_DIALOG_ADD}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5, maxHeight: 'min(85vh, 720px)', overflow: 'auto' }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.QUIZ_TITLE}
            value={classDetailQuizForm.title}
            onChange={(e) => setClassDetailQuizForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.QUIZ_DESC}
            value={classDetailQuizForm.description}
            onChange={(e) => setClassDetailQuizForm((f) => ({ ...f, description: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            size="small"
            type="number"
            label={DASH_ADMIN.CLASS_LECTURE_SORT}
            value={classDetailQuizForm.sort_order}
            onChange={(e) => setClassDetailQuizForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            sx={{ maxWidth: 200 }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {DASH_ADMIN.QUIZ_QUESTIONS_SECTION}
          </Typography>
          {classDetailQuizForm.questions.map((row, qIdx) => (
            <Paper
              key={row._id}
              variant="outlined"
              sx={{ p: 2, pt: classDetailQuizForm.questions.length > 1 ? 4 : 2, position: 'relative' }}
            >
              {classDetailQuizForm.questions.length > 1 ? (
                <IconButton
                  type="button"
                  size="small"
                  aria-label={DASH_ADMIN.REMOVE_QUIZ_QUESTION}
                  onClick={() =>
                    setClassDetailQuizForm((f) => ({
                      ...f,
                      questions: f.questions.filter((_, i) => i !== qIdx),
                    }))
                  }
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              ) : null}
              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label={`${qIdx + 1}. ${DASH_ADMIN.QUIZ_QUESTION_TEXT}`}
                  required
                  value={row.question}
                  onChange={(e) => {
                    const next = [...classDetailQuizForm.questions];
                    next[qIdx] = { ...next[qIdx], question: e.target.value };
                    setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                  }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={DASH_ADMIN.QUIZ_OPTION_A}
                  value={row.a}
                  onChange={(e) => {
                    const next = [...classDetailQuizForm.questions];
                    next[qIdx] = { ...next[qIdx], a: e.target.value };
                    setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                  }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={DASH_ADMIN.QUIZ_OPTION_B}
                  value={row.b}
                  onChange={(e) => {
                    const next = [...classDetailQuizForm.questions];
                    next[qIdx] = { ...next[qIdx], b: e.target.value };
                    setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                  }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={DASH_ADMIN.QUIZ_OPTION_C}
                  value={row.c}
                  onChange={(e) => {
                    const next = [...classDetailQuizForm.questions];
                    next[qIdx] = { ...next[qIdx], c: e.target.value };
                    setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                  }}
                  fullWidth
                />
                <TextField
                  size="small"
                  label={DASH_ADMIN.QUIZ_OPTION_D}
                  value={row.d}
                  onChange={(e) => {
                    const next = [...classDetailQuizForm.questions];
                    next[qIdx] = { ...next[qIdx], d: e.target.value };
                    setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                  }}
                  fullWidth
                />
                <FormControl component="fieldset" variant="standard">
                  <Typography component="legend" variant="caption" sx={{ mb: 0.5, fontWeight: 600 }}>
                    {DASH_ADMIN.QUIZ_CORRECT}
                  </Typography>
                  <RadioGroup
                    row
                    value={String(row.correct)}
                    onChange={(e) => {
                      const next = [...classDetailQuizForm.questions];
                      next[qIdx] = { ...next[qIdx], correct: Number(e.target.value) };
                      setClassDetailQuizForm((f) => ({ ...f, questions: next }));
                    }}
                  >
                    {['A', 'B', 'C', 'D'].map((lab, oi) => (
                      <FormControlLabel key={lab} value={String(oi)} control={<Radio size="small" />} label={lab} />
                    ))}
                  </RadioGroup>
                </FormControl>
              </Stack>
            </Paper>
          ))}
          <Button
            type="button"
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
            onClick={() => setClassDetailQuizForm((f) => ({ ...f, questions: [...f.questions, newQuizQuestion()] }))}
          >
            {DASH_ADMIN.ADD_QUIZ_QUESTION}
          </Button>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button
            type="button"
            onClick={() => {
              setClassDetailQuizOpen(false);
              setClassDetailQuizEditing(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={classDetailSchOpen}
        onClose={() => {
          setClassDetailSchOpen(false);
          setClassDetailSchEditing(null);
        }}
        fullWidth
        maxWidth="sm"
        component="form"
        onSubmit={submitClassDetailSchedule}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {classDetailSchEditing ? DASH_ADMIN.CLASS_SCHEDULE_DIALOG_EDIT : DASH_ADMIN.CLASS_SCHEDULE_DIALOG_ADD}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <TextField
            required
            size="small"
            label={DASH_TEACHER.SCHEDULE_TITLE}
            value={classDetailSchForm.title}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
          />
          <TextField
            required
            size="small"
            type="datetime-local"
            label={DASH_TEACHER.SCHEDULE_START}
            value={classDetailSchForm.starts_at}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, starts_at: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="datetime-local"
            label={DASH_TEACHER.SCHEDULE_END}
            value={classDetailSchForm.ends_at}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, ends_at: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            label={DASH_TEACHER.SCHEDULE_LOCATION}
            value={classDetailSchForm.location}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, location: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_TEACHER.SCHEDULE_URL}
            value={classDetailSchForm.meeting_url}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, meeting_url: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_TEACHER.SCHEDULE_NOTES}
            value={classDetailSchForm.notes}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, notes: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
          />
          <TextField
            size="small"
            type="number"
            label={DASH_ADMIN.CLASS_LECTURE_SORT}
            value={classDetailSchForm.sort_order}
            onChange={(e) => setClassDetailSchForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            sx={{ maxWidth: 200 }}
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
          <Button
            type="button"
            onClick={() => {
              setClassDetailSchOpen(false);
              setClassDetailSchEditing(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained" size="medium">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={teamDialogOpen}
        onClose={() => {
          setTeamDialogOpen(false);
          setTeamEditingId(null);
        }}
        fullWidth
        maxWidth="sm"
        component="form"
        onSubmit={submitTeamForm}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {teamEditingId ? DASH_ADMIN.CMS_EDIT_TEAM : DASH_ADMIN.CMS_ADD_TEAM}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.CMS_COL_NAME}
            value={teamForm.name}
            onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.CMS_COL_ROLE}
            value={teamForm.role_title}
            onChange={(e) => setTeamForm((f) => ({ ...f, role_title: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_THUMB}
            value={teamForm.image_url}
            onChange={(e) => setTeamForm((f) => ({ ...f, image_url: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.CMS_COL_BIO}
            multiline
            minRows={2}
            value={teamForm.bio}
            onChange={(e) => setTeamForm((f) => ({ ...f, bio: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label={DASH_ADMIN.CMS_TH_ORDER}
            value={teamForm.sort_order}
            onChange={(e) => setTeamForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            type="button"
            onClick={() => {
              setTeamDialogOpen(false);
              setTeamEditingId(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={testiDialogOpen}
        onClose={() => {
          setTestiDialogOpen(false);
          setTestiEditingId(null);
        }}
        fullWidth
        maxWidth="md"
        component="form"
        onSubmit={submitTestiForm}
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          {testiEditingId ? DASH_ADMIN.CMS_EDIT_TESTI : DASH_ADMIN.CMS_ADD_TESTI}
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2.5 }}>
          <TextField
            required
            size="small"
            label={DASH_ADMIN.CMS_COL_NAME}
            value={testiForm.author_name}
            onChange={(e) => setTestiForm((f) => ({ ...f, author_name: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            type="email"
            label={DASH_ADMIN.TH_ENROLL_EMAIL}
            value={testiForm.author_email}
            onChange={(e) => setTestiForm((f) => ({ ...f, author_email: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.CMS_COL_ROLE}
            value={testiForm.author_title}
            onChange={(e) => setTestiForm((f) => ({ ...f, author_title: e.target.value }))}
            fullWidth
          />
          <TextField
            required
            size="small"
            label={DASH_ADMIN.CMS_COL_SRC}
            multiline
            minRows={4}
            value={testiForm.content}
            onChange={(e) => setTestiForm((f) => ({ ...f, content: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            label={DASH_ADMIN.LABEL_THUMB}
            value={testiForm.image_url}
            onChange={(e) => setTestiForm((f) => ({ ...f, image_url: e.target.value }))}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            inputProps={{ min: 1, max: 5 }}
            label={DASH_ADMIN.CMS_COL_RATING}
            value={testiForm.rating}
            onChange={(e) => setTestiForm((f) => ({ ...f, rating: Number(e.target.value) }))}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label={DASH_ADMIN.CMS_TH_ORDER}
            value={testiForm.sort_order}
            onChange={(e) => setTestiForm((f) => ({ ...f, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            type="button"
            onClick={() => {
              setTestiDialogOpen(false);
              setTestiEditingId(null);
            }}
          >
            {COMMON.CANCEL}
          </Button>
          <Button type="submit" variant="contained">
            {COMMON.SAVE}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={contactViewOpen}
        onClose={() => {
          setContactViewOpen(false);
          setContactViewRow(null);
        }}
        fullWidth
        maxWidth="sm"
        PaperProps={{ elevation: 8, sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>{DASH_ADMIN.CMS_CONTACT_DETAIL}</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 2.5 }}>
          {contactViewRow ? (
            <>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                {DASH_ADMIN.CMS_COL_NAME}
              </Typography>
              <Typography variant="body1">{contactViewRow.name || '\u2014'}</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1 }}>
                {DASH_ADMIN.TH_ENROLL_EMAIL}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                {contactViewRow.email || '\u2014'}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1 }}>
                {CONTACT_PAGE.SUBJECT}
              </Typography>
              <Typography variant="body2">{contactViewRow.subject || '\u2014'}</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1 }}>
                {DASH_ADMIN.TH_ENROLL_DATE}
              </Typography>
              <Typography variant="body2">
                {contactViewRow.created_at ? new Date(contactViewRow.created_at).toLocaleString('vi-VN') : '\u2014'}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mt: 1 }}>
                {DASH_ADMIN.TH_MESSAGE}
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 360, overflow: 'auto' }}>
                <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {contactViewRow.message || '\u2014'}
                </Typography>
              </Paper>
            </>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Button
            type="button"
            color="error"
            variant="outlined"
            onClick={() => {
              if (contactViewRow?.id) void deleteContactRow(contactViewRow.id);
            }}
            disabled={!contactViewRow?.id}
            startIcon={<Trash2 className="h-4 w-4" />}
          >
            {COMMON.DELETE}
          </Button>
          <Button
            type="button"
            onClick={() => {
              setContactViewOpen(false);
              setContactViewRow(null);
            }}
            variant="contained"
          >
            {COMMON.CANCEL}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
