import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

// Replaces P5's 'Post feature coming soon' placeholder with a working
// Firestore-backed post creator, so screenshots can show saved post documents.
export default function Posts() {
  const { user, checkingAuth } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { document.title = 'Community posts | DEV@Deakin'; }, []);
  useEffect(() => {
    if (!db) { setLoading(false); setError('Configure your Firebase project to see posts.'); return undefined; }
    return onSnapshot(collection(db, 'posts'), (snapshot) => {
      const results = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      results.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPosts(results);
      setLoading(false);
      setError('');
    }, (failure) => {
      console.error('Could not read posts:', failure);
      setError('Could not load Firestore posts. Deploy the D1 Firestore security rules.');
      setLoading(false);
    });
  }, []);

  const savePost = async (event) => {
    event.preventDefault();
    setFeedback('');
    setError('');
    if (!user || !db) { setError('Log in and configure Firebase before publishing a post.'); return; }
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 100) { setError('Post title must be 3–100 characters.'); return; }
    if (trimmedBody.length < 10 || trimmedBody.length > 2000) { setError('Post content must be 10–2,000 characters.'); return; }
    setSending(true);
    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: (user.displayName || 'DEV@Deakin member').slice(0, 80),
        title: trimmedTitle,
        body: trimmedBody,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setBody('');
      setFeedback('Your post was saved successfully to Firestore.');
    } catch (failure) {
      console.error('Could not create post:', failure);
      setError('Unable to save your post. Check Firestore rules and your connection.');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="d1-posts-page">
      <div className="d1-posts-container">
        <p className="d1-eyebrow">DEV@DEAKIN / COMMUNITY</p>
        <h1>Share what you are <em>building.</em></h1>
        <p className="d1-posts-intro">Create a short community post and see it saved in Cloud Firestore. Your P5 portfolio, login and newsletter still work as before.</p>
        <div className="d1-posts-grid">
          <section className="d1-posts-editor">
            <h2>Write a post</h2>
            {checkingAuth ? <p>Checking your account…</p> : !user ? (
              <div className="d1-posts-auth"><p>You need to log in before creating a post.</p><Link className="d1-button d1-button-primary" to="/login">Log in to write <span aria-hidden="true">→</span></Link></div>
            ) : (
              <form onSubmit={savePost} noValidate>
                <label htmlFor="d1-post-title">Post title</label>
                <input id="d1-post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="What have you been learning?" required />
                <label htmlFor="d1-post-body">Your post</label>
                <textarea id="d1-post-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} rows={7} placeholder="Tell the community about your work, project or discovery…" required />
                <div className="d1-editor-bottom"><small>{body.length}/2000 characters</small><button className="d1-button d1-button-primary" type="submit" disabled={sending}>{sending ? 'Saving…' : 'Publish post'} <span aria-hidden="true">→</span></button></div>
              </form>
            )}
            {feedback && <p className="d1-success-banner" role="status">{feedback}</p>}
            {error && <p className="d1-banner-error" role="alert">{error}</p>}
          </section>
          <section className="d1-posts-feed" aria-label="Published community posts">
            <div className="d1-posts-feed-header"><h2>Latest posts</h2><span>{posts.length} saved</span></div>
            {loading ? <p className="d1-empty-posts">Loading posts…</p> : posts.length === 0 ? <p className="d1-empty-posts">No posts yet. Be the first to share something.</p> : (
              posts.map((post) => (
                <article key={post.id} className="d1-post-item">
                  <div className="d1-post-meta"><span>{post.authorName || 'Member'}</span><time>{post.createdAt?.toDate?.()?.toLocaleDateString() || 'Just now'}</time></div>
                  <h3>{post.title}</h3><p>{post.body}</p>
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
