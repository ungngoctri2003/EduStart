import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  Paper,
  Rating,
  Stack,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { GraduationCap, MessageCircle, Star, User } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { ClassCatalogCard } from '../components/ClassCatalogCard';
import { apiFetch } from '../lib/api';
import { useStudentCatalogAccess } from '../hooks/useStudentCatalogAccess';
import { useAuth } from '../context/useAuth';
import { ImageReveal, ScrollSection } from '../motion/ScrollBlock';
import { COURSE_DETAIL, PAYMENT, COMMON, ERR } from '../strings/vi';
import { formatVndFromPriceCentsOrFree } from '../utils/money.js';

function stripEnrollSearch(pathname, search) {
  const sp = new URLSearchParams(search);
  sp.delete('enroll');
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

function ForumUserAvatar({ size = 40 }) {
  const iconPx = Math.round(size * 0.45);
  return (
    <Avatar
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.35 : 0.2),
        color: 'primary.main',
      }}
      alt=""
    >
      <User width={iconPx} height={iconPx} aria-hidden />
    </Avatar>
  );
}

function truncateForumBody(text, maxLen = 220) {
  if (typeof text !== 'string' || !text) return '';
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function buildCommentTree(items) {
  const byParent = new Map();
  for (const item of items || []) {
    const key = item.parent_comment_id || 'root';
    const arr = byParent.get(key) || [];
    arr.push(item);
    byParent.set(key, arr);
  }
  const walk = (parentKey) => {
    const arr = byParent.get(parentKey) || [];
    return arr.map((node) => ({ ...node, children: walk(node.id) }));
  };
  return walk('root');
}

export function CourseDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { session, profile } = useAuth();
  const [course, setCourse] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [myEnrollments, setMyEnrollments] = useState(null);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [nonStudentDialogOpen, setNonStudentDialogOpen] = useState(false);
  const autoEnrollRunning = useRef(false);
  const [reviewBundle, setReviewBundle] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState('');
  const [reviewFormMsg, setReviewFormMsg] = useState('');
  const [formRating, setFormRating] = useState(5);
  const [formComment, setFormComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [courseClasses, setCourseClasses] = useState([]);
  const [courseClassesLoading, setCourseClassesLoading] = useState(false);
  const [forumPosts, setForumPosts] = useState([]);
  const [forumLoading, setForumLoading] = useState(false);
  const [forumErr, setForumErr] = useState('');
  const [forumPostDraft, setForumPostDraft] = useState('');
  const [forumGuestName, setForumGuestName] = useState('');
  const [forumSubmitting, setForumSubmitting] = useState(false);
  const [forumPostDialogOpen, setForumPostDialogOpen] = useState(false);
  const [forumActivePost, setForumActivePost] = useState(null);
  const [forumDialogComments, setForumDialogComments] = useState([]);
  const [forumDialogLoading, setForumDialogLoading] = useState(false);
  const [forumDetailErr, setForumDetailErr] = useState('');
  const [forumDialogRootCommentDraft, setForumDialogRootCommentDraft] = useState('');
  const [forumReplyDraft, setForumReplyDraft] = useState('');
  const [forumReplyTarget, setForumReplyTarget] = useState(null);
  const [forumNicknameDialogOpen, setForumNicknameDialogOpen] = useState(false);
  const [forumNicknameDialogDraft, setForumNicknameDialogDraft] = useState('');
  const [forumNicknameDialogErr, setForumNicknameDialogErr] = useState('');
  const forumNicknamePendingRef = useRef(null);
  const forumNicknameInputRef = useRef(null);
  const reduce = useReducedMotion() ?? false;
  const { classPaymentById, classCertificateEligibleById } = useStudentCatalogAccess();

  const isStudent = profile?.role === 'student';
  const courseId = course?.id;
  const courseEnrollment =
    Boolean(courseId) && Array.isArray(myEnrollments)
      ? myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId) ?? null
      : null;
  const enrollApproved =
    Boolean(courseEnrollment) &&
    (courseEnrollment.payment_status === 'approved' || courseEnrollment.payment_status == null);
  const hasScheduledClasses = !courseClassesLoading && courseClasses.length > 0;
  const classApprovedForCourse =
    Boolean(courseId) &&
    courseClasses.some((k) => {
      const st = classPaymentById.get(k.id);
      return st === 'approved' || st == null;
    });
  const hasCourseAccess = enrollApproved || classApprovedForCourse;

  const anyPendingPayment =
    courseEnrollment?.payment_status === 'pending' ||
    courseClasses.some((k) => classPaymentById.get(k.id) === 'pending');
  const anyRejectedPayment =
    courseEnrollment?.payment_status === 'rejected' ||
    courseClasses.some((k) => classPaymentById.get(k.id) === 'rejected');

  const refreshMyEnrollments = useCallback(async () => {
    if (!session?.access_token || !isStudent) {
      setMyEnrollments([]);
      return;
    }
    try {
      const data = await apiFetch('/api/enrollments/me', {}, session.access_token);
      setMyEnrollments(data || []);
    } catch {
      setMyEnrollments([]);
    }
  }, [session?.access_token, isStudent]);

  useEffect(() => {
    let cancelled = false;
    setErr('');
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}`);
        if (!cancelled) {
          setCourse(data);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || ERR.NOT_FOUND);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setCourseClasses([]);
      setCourseClassesLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setCourseClassesLoading(true);
    (async () => {
      try {
        const data = await apiFetch(`/api/courses/${encodeURIComponent(slug)}/classes`);
        if (!cancelled) setCourseClasses(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCourseClasses([]);
      } finally {
        if (!cancelled) setCourseClassesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!courseId || !session || !isStudent) {
        if (!cancelled) setMyEnrollments(session && !isStudent ? [] : null);
        return;
      }
      try {
        const data = await apiFetch('/api/enrollments/me', {}, session.access_token);
        if (!cancelled) setMyEnrollments(data || []);
      } catch {
        if (!cancelled) setMyEnrollments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, session?.access_token, session, isStudent]);

  useEffect(() => {
    return () => {
      autoEnrollRunning.current = false;
    };
  }, [slug]);

  const loadReviews = useCallback(async () => {
    if (!slug) return;
    setReviewErr('');
    setReviewLoading(true);
    try {
      const data = await apiFetch(
        `/api/courses/${encodeURIComponent(slug)}/reviews?limit=40`,
        {},
        session?.access_token ?? null,
      );
      setReviewBundle(data);
      if (data?.myReview) {
        setFormRating(data.myReview.rating);
        setFormComment(data.myReview.comment || '');
      } else {
        setFormRating(5);
        setFormComment('');
      }
    } catch (e) {
      setReviewErr(e.message || ERR.LOAD);
      setReviewBundle(null);
    } finally {
      setReviewLoading(false);
    }
  }, [slug, session?.access_token]);

  useEffect(() => {
    if (!slug) return;
    void loadReviews();
  }, [slug, loadReviews]);

  const submitReview = useCallback(async () => {
    if (!session?.access_token || !slug) return;
    setReviewFormMsg('');
    setReviewSubmitting(true);
    try {
      await apiFetch(
        `/api/learn/courses/${encodeURIComponent(slug)}/reviews`,
        {
          method: 'PUT',
          body: JSON.stringify({ rating: formRating, comment: formComment.trim() ? formComment.trim() : null }),
        },
        session.access_token,
      );
      setReviewFormMsg(COURSE_DETAIL.REVIEW_SAVED);
      await loadReviews();
    } catch (e) {
      setReviewFormMsg(e.data?.error || e.message || COURSE_DETAIL.REVIEW_ERR);
    } finally {
      setReviewSubmitting(false);
    }
  }, [session?.access_token, slug, formRating, formComment, loadReviews]);

  const loadForum = useCallback(async () => {
    if (!slug) return [];
    setForumErr('');
    setForumLoading(true);
    try {
      const postRes = await apiFetch(
        `/api/course-forum/courses/${encodeURIComponent(slug)}/posts?limit=20`,
        {},
        session?.access_token ?? null,
      );
      const posts = Array.isArray(postRes?.items) ? postRes.items : [];
      setForumPosts(posts);
      return posts;
    } catch (e) {
      setForumErr(e.message || COURSE_DETAIL.FORUM_LOAD_ERR);
      setForumPosts([]);
      return [];
    } finally {
      setForumLoading(false);
    }
  }, [slug, session?.access_token]);

  const loadForumPostComments = useCallback(
    async (postId) => {
      if (!slug || !postId) return;
      setForumDialogLoading(true);
      setForumDetailErr('');
      try {
        const commentsRes = await apiFetch(
          `/api/course-forum/courses/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments`,
          {},
          session?.access_token ?? null,
        );
        const items = Array.isArray(commentsRes?.items) ? commentsRes.items : [];
        setForumDialogComments(items);
      } catch (e) {
        setForumDetailErr(e.message || COURSE_DETAIL.FORUM_LOAD_ERR);
        setForumDialogComments([]);
      } finally {
        setForumDialogLoading(false);
      }
    },
    [slug, session?.access_token],
  );

  function openForumPost(post) {
    setForumActivePost(post);
    setForumPostDialogOpen(true);
    setForumDialogRootCommentDraft('');
    setForumReplyDraft('');
    setForumReplyTarget(null);
    setForumDetailErr('');
    void loadForumPostComments(post.id);
  }

  function closeForumPostDialog() {
    setForumPostDialogOpen(false);
    setForumActivePost(null);
    setForumDialogComments([]);
    setForumDialogRootCommentDraft('');
    setForumReplyDraft('');
    setForumReplyTarget(null);
    setForumDetailErr('');
  }

  useEffect(() => {
    if (!slug) return;
    void loadForum();
  }, [slug, loadForum]);

  useEffect(() => {
    if (!forumNicknameDialogOpen) return;
    const id = window.setTimeout(
      () => {
        forumNicknameInputRef.current?.focus();
      },
      reduce ? 0 : 80,
    );
    return () => window.clearTimeout(id);
  }, [forumNicknameDialogOpen, reduce]);

  const submitForumPost = useCallback(
    async (guestNameOverride) => {
      if (!slug) return;
      const content = forumPostDraft.trim();
      if (!content) return;
      const guestName = session ? null : String(guestNameOverride ?? forumGuestName).trim();
      if (!session && (!guestName || guestName.length < 2)) return;
      setForumSubmitting(true);
      setForumErr('');
      try {
        await apiFetch(
          `/api/course-forum/courses/${encodeURIComponent(slug)}/posts`,
          {
            method: 'POST',
            body: JSON.stringify({
              content,
              guest_name: session ? null : guestName,
            }),
          },
          session?.access_token ?? null,
        );
        setForumPostDraft('');
        await loadForum();
      } catch (e) {
        setForumErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
      } finally {
        setForumSubmitting(false);
      }
    },
    [slug, forumPostDraft, forumGuestName, session, loadForum],
  );

  const submitForumComment = useCallback(
    async (parentCommentId = null, guestNameOverride) => {
      const postId = forumActivePost?.id;
      if (!slug || !postId) return;
      const raw = parentCommentId ? forumReplyDraft : forumDialogRootCommentDraft;
      const content = raw.trim();
      if (!content) return;
      const guestName = session ? null : String(guestNameOverride ?? forumGuestName).trim();
      if (!session && (!guestName || guestName.length < 2)) return;
      setForumSubmitting(true);
      setForumDetailErr('');
      try {
        await apiFetch(
          `/api/course-forum/courses/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}/comments`,
          {
            method: 'POST',
            body: JSON.stringify({
              content,
              parent_comment_id: parentCommentId,
              guest_name: session ? null : guestName,
            }),
          },
          session?.access_token ?? null,
        );
        if (parentCommentId) {
          setForumReplyDraft('');
          setForumReplyTarget(null);
        } else {
          setForumDialogRootCommentDraft('');
        }
        await loadForumPostComments(postId);
        const refreshed = await loadForum();
        const next = refreshed?.find((p) => p.id === postId);
        if (next) setForumActivePost(next);
      } catch (e) {
        setForumDetailErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
      } finally {
        setForumSubmitting(false);
      }
    },
    [
      slug,
      forumActivePost?.id,
      forumReplyDraft,
      forumDialogRootCommentDraft,
      forumGuestName,
      session,
      loadForum,
      loadForumPostComments,
    ],
  );

  function openForumNicknameDialog(pending) {
    forumNicknamePendingRef.current = pending;
    setForumNicknameDialogDraft(forumGuestName);
    setForumNicknameDialogErr('');
    setForumNicknameDialogOpen(true);
  }

  function cancelForumNicknameDialog() {
    forumNicknamePendingRef.current = null;
    setForumNicknameDialogOpen(false);
    setForumNicknameDialogErr('');
  }

  function requestSubmitForumPost() {
    if (!slug) return;
    if (!forumPostDraft.trim()) return;
    if (!session && forumGuestName.trim().length < 2) {
      openForumNicknameDialog({ kind: 'post' });
      return;
    }
    void submitForumPost();
  }

  function requestSubmitForumComment(parentCommentId = null) {
    const postId = forumActivePost?.id;
    if (!slug || !postId) return;
    const raw = parentCommentId ? forumReplyDraft : forumDialogRootCommentDraft;
    if (!raw.trim()) return;
    if (!session && forumGuestName.trim().length < 2) {
      openForumNicknameDialog({ kind: 'comment', parentCommentId: parentCommentId ?? null });
      return;
    }
    void submitForumComment(parentCommentId);
  }

  function confirmForumNicknameDialog() {
    const g = forumNicknameDialogDraft.trim();
    if (g.length < 2) {
      setForumNicknameDialogErr(COURSE_DETAIL.FORUM_NICKNAME_TOO_SHORT);
      return;
    }
    if (g.length > 80) {
      setForumNicknameDialogErr(COURSE_DETAIL.FORUM_NICKNAME_TOO_LONG);
      return;
    }
    setForumGuestName(g);
    const pending = forumNicknamePendingRef.current;
    forumNicknamePendingRef.current = null;
    setForumNicknameDialogOpen(false);
    setForumNicknameDialogErr('');
    if (pending?.kind === 'post') {
      void submitForumPost(g);
    } else if (pending?.kind === 'comment') {
      void submitForumComment(pending.parentCommentId ?? null, g);
    }
  }

  useEffect(() => {
    if (searchParams.get('enroll') !== '1' || !courseId || !session || !isStudent) return;
    if (myEnrollments === null) return;
    if (courseClassesLoading) return;
    if (autoEnrollRunning.current) return;
    autoEnrollRunning.current = true;

    const cleanPath = stripEnrollSearch(location.pathname, location.search);
    const row = myEnrollments.find((r) => r.course_id === courseId || r.courses?.id === courseId);

    (async () => {
      try {
        if (courseClasses.length > 0) {
          navigate(cleanPath, { replace: true });
          return;
        }
        if (row?.payment_status === 'approved' || (row && row.payment_status == null)) {
          navigate(cleanPath, { replace: true });
          return;
        }
        if (row?.payment_status === 'pending') {
          setMsg(PAYMENT.PENDING_MSG);
          navigate(cleanPath, { replace: true });
          return;
        }
        try {
          await apiFetch(
            '/api/enrollments',
            { method: 'POST', body: JSON.stringify({ course_id: courseId }) },
            session.access_token,
          );
          setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
          await refreshMyEnrollments();
        } catch (e) {
          setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
        }
        navigate(cleanPath, { replace: true });
      } finally {
        autoEnrollRunning.current = false;
      }
    })();
  }, [
    searchParams,
    courseId,
    session,
    isStudent,
    myEnrollments,
    courseClassesLoading,
    courseClasses.length,
    location.pathname,
    location.search,
    navigate,
    refreshMyEnrollments,
  ]);

  const enrollViaCourseOnly = !courseClassesLoading && courseClasses.length === 0;
  const returnPathForAuth = slug ? `/courses/${slug}${enrollViaCourseOnly ? '?enroll=1' : ''}` : '/dashboard';

  function openEnrollFlow() {
    setMsg('');
    if (!session) {
      setEnrollDialogOpen(true);
      return;
    }
    if (!isStudent) {
      setNonStudentDialogOpen(true);
      return;
    }
    void confirmCourseEnroll();
  }

  async function confirmCourseEnroll() {
    setMsg('');
    if (!session) {
      setEnrollDialogOpen(true);
      return;
    }
    if (!isStudent) {
      setNonStudentDialogOpen(true);
      return;
    }
    if (!course?.id) return;
    setEnrolling(true);
    try {
      const res = await apiFetch('/api/enrollments', { method: 'POST', body: JSON.stringify({ course_id: course.id }) }, session.access_token);
      const st = res?.payment_status;
      if (st === 'approved' || st == null) {
        setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
        await refreshMyEnrollments();
      } else {
        setMsg(PAYMENT.PENDING_MSG);
        await refreshMyEnrollments();
      }
    } catch (e) {
      if (e.status === 409) {
        const st = e.data?.payment_status;
        if (st === 'approved') {
          setMsg(COURSE_DETAIL.ENROLL_SUCCESS);
          await refreshMyEnrollments();
        } else if (st === 'pending') {
          setMsg(PAYMENT.ALREADY_PENDING);
          await refreshMyEnrollments();
        } else {
          setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
        }
      } else {
        setMsg(e.data?.message || e.data?.error || e.message || ERR.ENROLL_FAILED);
      }
    } finally {
      setEnrolling(false);
    }
  }

  if (err || !course) {
    return (
      <>
        <PageHeader
          title={COURSE_DETAIL.TITLE_FALLBACK}
          crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: slug || '', active: true }]}
        />
        <Box className="container mx-auto max-w-2xl px-4 py-16">
          {!course && !err ? (
            <Paper
              elevation={0}
              sx={{
                p: 5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                borderStyle: 'dashed',
              }}
            >
              <CircularProgress size={32} />
              <Typography color="text.secondary" fontWeight={500}>
                {COMMON.LOADING}
              </Typography>
            </Paper>
          ) : (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              {err || COMMON.LOADING}
            </Alert>
          )}
          <Button component={Link} to="/courses" variant="text" color="primary" sx={{ mt: 2, px: 0 }}>
            {COURSE_DETAIL.BACK}
          </Button>
        </Box>
      </>
    );
  }

  const enrollOk = msg === COURSE_DETAIL.ENROLL_SUCCESS;
  const enrollPendingInfo = msg === PAYMENT.PENDING_MSG || msg === PAYMENT.ALREADY_PENDING;

  async function editForumPost(post) {
    const next = window.prompt(COURSE_DETAIL.FORUM_EDIT, post.content || '');
    if (next == null) return;
    const content = next.trim();
    if (!content) return;
    try {
      await apiFetch(
        `/api/course-forum/posts/${encodeURIComponent(post.id)}`,
        { method: 'PATCH', body: JSON.stringify({ content }) },
        session?.access_token ?? null,
      );
      const refreshed = await loadForum();
      const nextPost = refreshed?.find((p) => p.id === post.id);
      if (nextPost && forumActivePost?.id === post.id) setForumActivePost(nextPost);
    } catch (e) {
      setForumDetailErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
    }
  }

  async function deleteForumPost(post) {
    if (!window.confirm(COURSE_DETAIL.FORUM_DELETE)) return;
    try {
      await apiFetch(`/api/course-forum/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' }, session?.access_token ?? null);
      if (forumActivePost?.id === post.id) closeForumPostDialog();
      await loadForum();
    } catch (e) {
      setForumDetailErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
    }
  }

  async function editForumComment(comment) {
    const next = window.prompt(COURSE_DETAIL.FORUM_EDIT, comment.content || '');
    if (next == null) return;
    const content = next.trim();
    if (!content) return;
    const postId = forumActivePost?.id;
    try {
      await apiFetch(
        `/api/course-forum/comments/${encodeURIComponent(comment.id)}`,
        { method: 'PATCH', body: JSON.stringify({ content }) },
        session?.access_token ?? null,
      );
      if (slug && postId) await loadForumPostComments(postId);
      await loadForum();
    } catch (e) {
      setForumDetailErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
    }
  }

  async function deleteForumComment(comment) {
    if (!window.confirm(COURSE_DETAIL.FORUM_DELETE)) return;
    const postId = forumActivePost?.id;
    try {
      await apiFetch(`/api/course-forum/comments/${encodeURIComponent(comment.id)}`, { method: 'DELETE' }, session?.access_token ?? null);
      if (slug && postId) await loadForumPostComments(postId);
      const refreshed = await loadForum();
      const nextPost = refreshed?.find((p) => p.id === postId);
      if (nextPost && forumActivePost?.id === postId) setForumActivePost(nextPost);
    } catch (e) {
      setForumDetailErr(e.data?.error || e.message || COURSE_DETAIL.FORUM_SEND_ERR);
    }
  }

  function renderCommentNodes(nodes, depth = 0) {
    return nodes.map((node) => (
      <Box key={node.id} sx={{ pl: depth > 0 ? 2 : 0, borderLeft: depth > 0 ? '1px solid' : 'none', borderColor: 'divider', mt: 1.25 }}>
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: '1 1 auto' }}>
              <ForumUserAvatar size={32} />
              <Typography fontWeight={700}>{node.author_name || 'Khách'}</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, textAlign: 'right' }}>
              {node.created_at ? new Date(node.created_at).toLocaleString('vi-VN') : ''}
            </Typography>
          </Stack>
          <Typography variant="body2" color={node.deleted_at ? 'text.disabled' : 'text.secondary'} sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
            {node.deleted_at ? COURSE_DETAIL.FORUM_DELETED : node.content}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
            {!node.deleted_at ? (
              <Button size="small" onClick={() => setForumReplyTarget({ parentId: node.id })}>
                {COURSE_DETAIL.FORUM_REPLY_BTN}
              </Button>
            ) : null}
            {node.can_edit && !node.deleted_at ? (
              <>
                <Button size="small" onClick={() => void editForumComment(node)}>
                  {COURSE_DETAIL.FORUM_EDIT}
                </Button>
                <Button size="small" color="error" onClick={() => void deleteForumComment(node)}>
                  {COURSE_DETAIL.FORUM_DELETE}
                </Button>
              </>
            ) : null}
          </Stack>
          {forumReplyTarget?.parentId === node.id ? (
            <Box sx={{ mt: 1.25 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                placeholder={COURSE_DETAIL.FORUM_REPLY_PLACEHOLDER}
                value={forumReplyDraft}
                onChange={(e) => setForumReplyDraft(e.target.value)}
              />
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="contained" disabled={forumSubmitting} onClick={() => requestSubmitForumComment(node.id)}>
                  {COURSE_DETAIL.FORUM_REPLY_BTN}
                </Button>
                <Button size="small" onClick={() => setForumReplyTarget(null)}>
                  {COURSE_DETAIL.FORUM_CANCEL_REPLY}
                </Button>
              </Stack>
            </Box>
          ) : null}
        </Paper>
        {node.children?.length > 0 ? renderCommentNodes(node.children, depth + 1) : null}
      </Box>
    ));
  }

  return (
    <>
      <PageHeader title={course.title} crumbs={[{ label: COURSE_DETAIL.CRUMB, to: '/courses' }, { label: course.title, active: true }]} />
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-10 md:grid-cols-2">
          <ImageReveal reduced={reduce} className="min-w-0">
            <Box
              className="h-full min-h-0 overflow-hidden rounded-2xl"
              sx={{ border: 1, borderColor: 'divider', boxShadow: (t) => t.shadows[3] }}
            >
              <Box
                component="img"
                src={course.thumbnail_url || '/img/course-1.png'}
                alt=""
                sx={{ width: '100%', height: '100%', minHeight: 200, objectFit: 'cover', display: 'block' }}
              />
            </Box>
          </ImageReveal>
          <ScrollSection reduced={reduce} className="min-w-0">
            <h2 className="font-display text-3xl font-bold text-primary">{course.title}</h2>
            <p className="mt-4 text-base-content/80">{course.description || COURSE_DETAIL.NO_DESC}</p>
            <p className="mt-4 text-sm text-base-content/70">
              <strong>{COURSE_DETAIL.LEVEL}:</strong> {course.level || '—'} · <strong>{COURSE_DETAIL.DURATION}:</strong>{' '}
              {course.duration_hours != null ? `${course.duration_hours} ${COMMON.HOURS}` : '—'}
              {hasScheduledClasses ? (
                <>
                  {' '}
                  · <strong>{COMMON.FEE_LABEL}:</strong> {COURSE_DETAIL.FEE_VIA_CLASS}
                </>
              ) : (
                <>
                  {' '}
                  · <strong>{COMMON.FEE_LABEL}:</strong> {formatVndFromPriceCentsOrFree(course.price_cents, COMMON.FREE)}
                </>
              )}
            </p>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.5, rowGap: 1 }}>
              {course.review_avg != null ? (
                <Chip
                  size="small"
                  icon={<Star className="h-3.5 w-3.5" aria-hidden style={{ color: 'var(--mui-palette-warning-main)' }} />}
                  label={`${COURSE_DETAIL.RATING}: ${course.review_avg}`}
                  variant="outlined"
                />
              ) : null}
              {Number(course.review_count) > 0 ? (
                <Chip
                  size="small"
                  label={`${course.review_count} ${COURSE_DETAIL.REVIEW_VOTES}`}
                  variant="outlined"
                />
              ) : null}
              {course.enrollment_count != null && course.enrollment_count > 0 ? (
                <Chip
                  size="small"
                  label={`${COURSE_DETAIL.ENROLLMENT_LABEL}: ${course.enrollment_count}`}
                  variant="outlined"
                />
              ) : null}
            </Stack>
            {msg ? (
              <Alert severity={enrollOk ? 'success' : enrollPendingInfo ? 'info' : 'warning'} sx={{ mt: 2 }}>
                {msg}
              </Alert>
            ) : null}
            {isStudent && !hasCourseAccess && anyPendingPayment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.PENDING_MSG}
              </Alert>
            ) : null}
            {isStudent && !hasCourseAccess && anyRejectedPayment && !anyPendingPayment && !msg ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {PAYMENT.REJECTED_HINT}
              </Alert>
            ) : null}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
              {isStudent && hasCourseAccess ? (
                <Button type="button" variant="outlined" color="primary" component={Link} to={`/dashboard/student`}>
                  {COURSE_DETAIL.GO_DASHBOARD}
                </Button>
              ) : null}
              {isStudent && !hasCourseAccess && !anyPendingPayment && !courseClassesLoading && courseClasses.length === 0 ? (
                <Button type="button" variant="contained" color="primary" disabled={enrolling} onClick={openEnrollFlow}>
                  {enrolling ? <CircularProgress size={22} color="inherit" sx={{ mr: 1 }} /> : null}
                  {enrolling ? COURSE_DETAIL.ENROLLING : COURSE_DETAIL.ENROLL}
                </Button>
              ) : null}
            </Stack>
          </ScrollSection>
        </div>

        <ScrollSection reduced={reduce} className="w-full" as="section" id="course-classes-section">
          <Paper
            elevation={0}
            sx={{
              mt: { xs: 5, md: 6 },
              p: { xs: 2.25, sm: 3 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              boxShadow: (t) => (t.palette.mode === 'dark' ? 'none' : `0 1px 3px ${alpha(t.palette.common.black, 0.06)}`),
            }}
          >
            <Stack
              direction="row"
              alignItems="flex-start"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={2}
              sx={{ gap: 2, mb: 2 }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: '1 1 240px' }}>
                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2.5,
                    bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.18 : 0.12),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <GraduationCap className="h-7 w-7" aria-hidden />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.09em', lineHeight: 1.2, display: 'block' }}>
                    {COURSE_DETAIL.CLASSES_SECTION_OVERLINE}
                  </Typography>
                  <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800, mt: 0.25 }}>
                    {COURSE_DETAIL.SECTION_CLASSES}
                  </Typography>
                </Box>
              </Stack>
              {!courseClassesLoading && courseClasses.length > 0 ? (
                <Chip
                  label={COURSE_DETAIL.CLASSES_OPEN_BADGE.replace('{n}', String(courseClasses.length))}
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 700, flexShrink: 0 }}
                />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: '48rem', lineHeight: 1.65 }}>
              {COURSE_DETAIL.CLASSES_LEAD}
            </Typography>
            {courseClassesLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{COMMON.LOADING}</Typography>
              </Box>
            ) : null}
            {!courseClassesLoading && courseClasses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {COURSE_DETAIL.NO_CLASSES}
              </Typography>
            ) : null}
            {!courseClassesLoading && courseClasses.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2.5,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                }}
              >
                {courseClasses.map((k) => (
                  <ClassCatalogCard
                    key={k.id}
                    klass={k}
                    courseSlug={k.course_slug ?? slug}
                    paymentStatus={classPaymentById.get(k.id) ?? null}
                    certificateEligible={Boolean(classCertificateEligibleById.get(k.id))}
                  />
                ))}
              </Box>
            ) : null}
          </Paper>
        </ScrollSection>

        <ScrollSection reduced={reduce} className="w-full" as="section">
          <Paper
            elevation={0}
            sx={{
              mt: { xs: 5, md: 6 },
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
              <MessageCircle className="h-6 w-6 shrink-0 text-primary" aria-hidden />
              <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800 }}>
                {COURSE_DETAIL.SECTION_FORUM}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {COURSE_DETAIL.FORUM_LEAD}
            </Typography>
            {forumErr ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {forumErr}
              </Alert>
            ) : null}
            {!session ? (
              <TextField
                fullWidth
                size="small"
                sx={{ mb: 1.5 }}
                label={COURSE_DETAIL.FORUM_GUEST_NAME}
                value={forumGuestName}
                onChange={(e) => setForumGuestName(e.target.value)}
              />
            ) : null}
            <TextField
              fullWidth
              multiline
              minRows={3}
              label={COURSE_DETAIL.FORUM_POST_PLACEHOLDER}
              value={forumPostDraft}
              onChange={(e) => setForumPostDraft(e.target.value)}
            />
            <Button variant="contained" sx={{ mt: 1.5, mb: 2.5 }} disabled={forumSubmitting} onClick={() => requestSubmitForumPost()}>
              {COURSE_DETAIL.FORUM_POST_BTN}
            </Button>
            {forumLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{COMMON.LOADING}</Typography>
              </Box>
            ) : null}
            {!forumLoading && forumPosts.length === 0 ? (
              <Typography color="text.secondary">{COURSE_DETAIL.FORUM_EMPTY}</Typography>
            ) : null}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {COURSE_DETAIL.FORUM_LIST_HINT}
            </Typography>
            {!forumLoading && forumPosts.length > 0 ? (
              <Stack spacing={2}>
                {forumPosts.map((post) => (
                  <Paper
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    variant="outlined"
                    onClick={() => openForumPost(post)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openForumPost(post);
                      }
                    }}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      cursor: 'pointer',
                      transition: 'box-shadow 160ms ease, border-color 160ms ease',
                      '&:hover': {
                        borderColor: (t) => alpha(t.palette.primary.main, 0.45),
                        boxShadow: (t) => t.shadows[2],
                      },
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1} flexWrap="wrap">
                      <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                        <ForumUserAvatar size={36} />
                        <Typography fontWeight={700} sx={{ minWidth: 0 }}>
                          {post.author_name || 'Khách'}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={COURSE_DETAIL.FORUM_COMMENT_COUNT.replace('{n}', String(Number(post.comment_count ?? 0)))}
                        sx={{ fontWeight: 600 }}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {post.created_at ? new Date(post.created_at).toLocaleString('vi-VN') : ''}
                    </Typography>
                    <Typography
                      variant="body2"
                      color={post.deleted_at ? 'text.disabled' : 'text.secondary'}
                      sx={{ mt: 1.25, whiteSpace: 'pre-wrap' }}
                    >
                      {post.deleted_at ? COURSE_DETAIL.FORUM_DELETED : truncateForumBody(post.content || '')}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      sx={{ mt: 1, px: 0 }}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        openForumPost(post);
                      }}
                    >
                      {COURSE_DETAIL.FORUM_OPEN_DETAIL}
                    </Button>
                  </Paper>
                ))}
              </Stack>
            ) : null}
          </Paper>
        </ScrollSection>

        <ScrollSection reduced={reduce} className="w-full" as="section">
          <Paper
            elevation={0}
            sx={{
              mt: { xs: 5, md: 6 },
              p: { xs: 2, sm: 3 },
              borderRadius: 3,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
              <MessageCircle className="h-6 w-6 shrink-0 text-primary" aria-hidden />
              <Typography component="h2" variant="h5" className="font-display" sx={{ fontWeight: 800 }}>
                {COURSE_DETAIL.SECTION_REVIEWS}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {COURSE_DETAIL.REVIEWS_LEAD}
            </Typography>
            {reviewErr ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {reviewErr}
              </Alert>
            ) : null}
            {reviewLoading && !reviewBundle ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2 }}>
                <CircularProgress size={24} />
                <Typography color="text.secondary">{COMMON.LOADING}</Typography>
              </Box>
            ) : null}
            {reviewBundle ? (
              <>
                <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mb: 2, rowGap: 1 }}>
                  {reviewBundle.summary?.review_avg != null && (
                    <Chip
                      size="small"
                      icon={<Star className="h-3.5 w-3.5" style={{ color: 'var(--mui-palette-warning-main)' }} aria-hidden />}
                      label={`${COURSE_DETAIL.RATING}: ${reviewBundle.summary.review_avg}`}
                      variant="outlined"
                    />
                  )}
                  <Chip
                    size="small"
                    label={`${reviewBundle.summary?.review_count ?? 0} ${COURSE_DETAIL.REVIEW_VOTES}`}
                    variant="outlined"
                  />
                </Stack>
                {isStudent && hasCourseAccess ? (
                  <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: 'action.hover' }}>
                    <Typography fontWeight={700} sx={{ mb: 1.5 }}>
                      {COURSE_DETAIL.YOUR_REVIEW}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {COURSE_DETAIL.STARS}
                    </Typography>
                    <Rating
                      name="course-review-rating"
                      value={formRating}
                      onChange={(_, v) => setFormRating(v ?? 5)}
                      size="large"
                      sx={{ mb: 1.5 }}
                    />
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      label={COURSE_DETAIL.COMMENT}
                      value={formComment}
                      onChange={(e) => setFormComment(e.target.value)}
                    />
                    {reviewFormMsg ? (
                      <Alert severity={reviewFormMsg === COURSE_DETAIL.REVIEW_SAVED ? 'success' : 'error'} sx={{ mt: 2 }}>
                        {reviewFormMsg}
                      </Alert>
                    ) : null}
                    <Button
                      type="button"
                      variant="contained"
                      color="primary"
                      disabled={reviewSubmitting}
                      onClick={() => void submitReview()}
                      sx={{ mt: 2 }}
                    >
                      {reviewSubmitting ? COURSE_DETAIL.SAVING_REVIEW : COURSE_DETAIL.SUBMIT_REVIEW}
                    </Button>
                  </Paper>
                ) : isStudent && !hasCourseAccess ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.REVIEW_MUST_ENROLL}
                  </Alert>
                ) : !session ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.REVIEW_GUEST}
                  </Alert>
                ) : (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {COURSE_DETAIL.ONLY_STUDENT}
                  </Alert>
                )}
                {reviewBundle.items?.length > 0 ? (
                  <Stack spacing={1.5}>
                    {reviewBundle.items.map((rv) => (
                      <Paper
                        key={rv.id}
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.06 : 0.04) }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                          <Typography fontWeight={700}>{rv.author_name}</Typography>
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'warning.main' }}>
                            {Array.from({ length: rv.rating }).map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" aria-hidden />
                            ))}
                          </Stack>
                        </Stack>
                        {rv.comment ? (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {rv.comment}
                          </Typography>
                        ) : null}
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {rv.created_at ? new Date(rv.created_at).toLocaleString('vi-VN') : ''}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : !reviewLoading ? (
                  <Typography color="text.secondary" sx={{ py: 1 }}>
                    {COURSE_DETAIL.NO_REVIEWS}
                  </Typography>
                ) : null}
              </>
            ) : null}
          </Paper>
        </ScrollSection>

      </div>

      <Dialog open={enrollDialogOpen} onClose={() => setEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{COURSE_DETAIL.DIALOG_AUTH_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {COURSE_DETAIL.DIALOG_AUTH_BODY}
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setEnrollDialogOpen(false)}>{COMMON.CANCEL}</Button>
          <Button variant="outlined" component={Link} to="/login" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {COURSE_DETAIL.DIALOG_LOGIN}
          </Button>
          <Button variant="contained" component={Link} to="/signup" state={{ from: returnPathForAuth }} onClick={() => setEnrollDialogOpen(false)}>
            {COURSE_DETAIL.DIALOG_SIGNUP}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={forumPostDialogOpen && Boolean(forumActivePost)}
        onClose={closeForumPostDialog}
        maxWidth="md"
        fullWidth
        scroll="paper"
        aria-labelledby="course-forum-detail-title"
      >
        <DialogTitle id="course-forum-detail-title">{COURSE_DETAIL.FORUM_DETAIL_TITLE}</DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {forumActivePost ? (
            <>
              {forumDetailErr ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {forumDetailErr}
                </Alert>
              ) : null}
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap">
                <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ flex: '1 1 auto', minWidth: 0 }}>
                  <ForumUserAvatar size={44} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      {forumActivePost.author_name || 'Khách'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      {forumActivePost.created_at ? new Date(forumActivePost.created_at).toLocaleString('vi-VN') : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  size="small"
                  variant="outlined"
                  label={COURSE_DETAIL.FORUM_COMMENT_COUNT.replace('{n}', String(Number(forumActivePost.comment_count ?? 0)))}
                  sx={{ fontWeight: 600, flexShrink: 0 }}
                />
              </Stack>
              <Typography
                variant="body1"
                color={forumActivePost.deleted_at ? 'text.disabled' : 'text.primary'}
                sx={{ mt: 1.75, whiteSpace: 'pre-wrap' }}
              >
                {forumActivePost.deleted_at ? COURSE_DETAIL.FORUM_DELETED : forumActivePost.content || ''}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {forumActivePost.can_edit && !forumActivePost.deleted_at ? (
                  <>
                    <Button size="small" onClick={() => void editForumPost(forumActivePost)}>
                      {COURSE_DETAIL.FORUM_EDIT}
                    </Button>
                    <Button size="small" color="error" onClick={() => void deleteForumPost(forumActivePost)}>
                      {COURSE_DETAIL.FORUM_DELETE}
                    </Button>
                  </>
                ) : null}
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {COURSE_DETAIL.FORUM_WRITE_COMMENT}
              </Typography>
              {!forumActivePost.deleted_at ? (
                <>
                  {!session ? (
                    <TextField
                      fullWidth
                      size="small"
                      sx={{ mb: 1.5 }}
                      label={COURSE_DETAIL.FORUM_GUEST_NAME}
                      value={forumGuestName}
                      onChange={(e) => setForumGuestName(e.target.value)}
                    />
                  ) : null}
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder={COURSE_DETAIL.FORUM_COMMENT_PLACEHOLDER}
                    value={forumDialogRootCommentDraft}
                    onChange={(e) => setForumDialogRootCommentDraft(e.target.value)}
                  />
                  <Button
                    variant="contained"
                    size="medium"
                    sx={{ mt: 1.25, mb: 2 }}
                    disabled={forumSubmitting}
                    onClick={() => requestSubmitForumComment()}
                  >
                    {COURSE_DETAIL.FORUM_COMMENT_BTN}
                  </Button>
                </>
              ) : null}
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, mt: 2 }}>
                {COURSE_DETAIL.FORUM_ALL_COMMENTS}
              </Typography>
            </>
          ) : null}
          {forumDialogLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">{COMMON.LOADING}</Typography>
            </Box>
          ) : forumActivePost ? (
            <Box sx={{ mt: 0.5 }}>
              {forumDialogComments.length === 0 ? (
                <Typography color="text.secondary">{COURSE_DETAIL.FORUM_NO_COMMENTS}</Typography>
              ) : (
                renderCommentNodes(buildCommentTree(forumDialogComments))
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeForumPostDialog}>{COURSE_DETAIL.FORUM_CLOSE}</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={forumNicknameDialogOpen}
        onClose={cancelForumNicknameDialog}
        maxWidth="sm"
        fullWidth
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        slots={{ transition: Fade }}
        slotProps={{
          transition: {
            timeout: reduce ? { enter: 0, exit: 0 } : { enter: 180, exit: 140 },
          },
          paper: {
            sx: {
              willChange: 'opacity',
              backfaceVisibility: 'hidden',
            },
          },
        }}
      >
        <DialogTitle>{COURSE_DETAIL.FORUM_NICKNAME_DIALOG_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {COURSE_DETAIL.FORUM_NICKNAME_DIALOG_LEAD}
          </Alert>
          <TextField
            inputRef={forumNicknameInputRef}
            fullWidth
            label={COURSE_DETAIL.FORUM_GUEST_NAME}
            value={forumNicknameDialogDraft}
            error={Boolean(forumNicknameDialogErr)}
            helperText={forumNicknameDialogErr || '\u200b'}
            FormHelperTextProps={
              forumNicknameDialogErr ? undefined : { sx: { typography: 'body2', minHeight: '1.333em', opacity: 0 } }
            }
            onChange={(e) => {
              setForumNicknameDialogDraft(e.target.value);
              if (forumNicknameDialogErr) setForumNicknameDialogErr('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                confirmForumNicknameDialog();
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={cancelForumNicknameDialog}>{COMMON.CANCEL}</Button>
          <Button variant="contained" onClick={() => confirmForumNicknameDialog()}>
            {COURSE_DETAIL.FORUM_NICKNAME_CONFIRM}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nonStudentDialogOpen} onClose={() => setNonStudentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{COURSE_DETAIL.DIALOG_ROLE_TITLE}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">{COURSE_DETAIL.ONLY_STUDENT}</Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNonStudentDialogOpen(false)}>{COMMON.CANCEL}</Button>
        </DialogActions>
      </Dialog>

    </>
  );
}
