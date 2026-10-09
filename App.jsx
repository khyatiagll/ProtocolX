import React, { useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown, Clipboard,
  FileImage, FileText, Flame, Heart, Info, ListChecks, LoaderCircle, MessageCircle,
  Moon, Plus, RotateCcw, Search, ShieldCheck, Sparkles, Sun, Upload, X
} from "lucide-react";
import { createWorker } from "tesseract.js";

const SAMPLE = `Maya: Hey team, are we still meeting for the project demo on Friday?
Arjun: Yes, Friday at 2 PM in Lab 3. I'll bring the prototype.
Nina: I can prepare the slides. Can someone send me the latest project screenshots?
Maya: I'll send the screenshots by Thursday evening.
Arjun: Decision: we will demonstrate the login flow and the summary dashboard, not the full analytics page.
Nina: Reminder: the report is due Monday. I can write the introduction if someone handles testing.
Maya: I'll test on Android and share results by Friday morning.
Arjun: Great. Open question: do we need a backup video in case Wi-Fi fails?
Nina: I think yes. I'll record one after the demo rehearsal.`;

function splitMessages(raw) {
  return raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, i) => {
    const match = line.match(/^([^:]{1,50}):\s*(.+)$/);
    return { speaker: match ? match[1].trim() : `Line ${i + 1}`, text: match ? match[2].trim() : line };
  });
}
function localSummary(raw) {
  const messages = splitMessages(raw);
  const all = messages.map(m => m.text);
  const important = messages.filter(m => /\b(important|urgent|reminder|decision|decided|deadline|due|by (monday|tuesday|wednesday|thursday|friday|tomorrow|today)|asap|must|blocked|issue|problem)\b/i.test(m.text));
  const actions = messages.filter(m => /\b(i'll|i will|we will|can you|please|need to|should|will prepare|will send|will test|will record|responsible|action item)\b/i.test(m.text));
  const decisions = messages.filter(m => /\b(decision|decided|agreed|we will|we'll)\b/i.test(m.text));
  const questions = messages.filter(m => /\?/.test(m.text));
  const unique = arr => [...new Map(arr.map(m => [m.text, m])).values()];
  const summaryLines = all.slice(0, 4).map(s => `- ${s}`);
  return {
    count: messages.length,
    quick: summaryLines.length ? summaryLines : ["- No readable messages were found."],
    important: unique(important).slice(0, 8),
    actions: unique(actions).slice(0, 8),
    decisions: unique(decisions).slice(0, 6),
    questions: unique(questions).slice(0, 6)
  };
}
function saveText(name, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}
function ResultList({ items, empty }) {
  if (!items?.length) return <p className="empty">{empty || "Nothing clearly identified in the text."}</p>;
  return <ul className="result-list">{items.map((m, i) => <li key={i}>{typeof m === "string" ? m : <><strong>{m.speaker}:</strong> {m.text}</>}</li>)}</ul>;
}

export default function App() {
  const [chat, setChat] = useState("");
  const [result, setResult] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [mode, setMode] = useState("local");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [dark, setDark] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [query, setQuery] = useState("");
  const fileRef = useRef(null);
  const imageRef = useRef(null);

  const filteredMessages = useMemo(() => {
    if (!result) return [];
    const all = [...result.important, ...result.actions, ...result.decisions, ...result.questions];
    const q = query.trim().toLowerCase();
    return q ? all.filter(m => `${m.speaker} ${m.text}`.toLowerCase().includes(q)) : all;
  }, [result, query]);

  function analyze() {
    if (!chat.trim()) { setStatus("Paste a conversation or load the sample first."); return; }
    setResult(localSummary(chat));
    setAiResult("");
    setStatus("Local analysis complete. Your chat was processed in this browser.");
  }
  async function summarizeWithAI() {
    if (!chat.trim()) { setStatus("Paste a conversation or load the sample first."); return; }
    setBusy(true); setStatus("Asking the AI service to summarize…");
    try {
      const response = await fetch("/api/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: chat })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI request failed.");
      setAiResult(data.summary);
      setResult(localSummary(chat));
      setStatus("AI summary ready.");
    } catch (error) {
      setStatus(error.message || "Could not reach the AI service.");
    } finally { setBusy(false); }
  }
  async function handleTextFile(file) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Please choose a file smaller than 5 MB.");
      const text = await file.text();
      if (!/\.(txt|md|csv|json)$/i.test(file.name)) throw new Error("For text files, use .txt, .md, .csv, or .json. For screenshots, use the image upload.");
      setChat(text); setResult(null); setAiResult("");
      setStatus(`Loaded ${file.name}. Select Local summary to analyze it.`);
    } catch (e) { setStatus(e.message); }
  }
  async function handleImage(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus("Choose an image file such as PNG or JPG."); return; }
    if (file.size > 8 * 1024 * 1024) { setStatus("Please choose an image smaller than 8 MB."); return; }
    setBusy(true); setStatus("Reading text from screenshot in your browser…");
    try {
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(file);
      await worker.terminate();
      if (!data.text.trim()) throw new Error("No readable text was found. Try a clearer screenshot.");
      setChat(prev => prev ? `${prev}\n${data.text}` : data.text);
      setStatus("Screenshot text added. Please review the extracted text for OCR mistakes.");
    } catch (e) { setStatus(e.message || "Could not read this image."); }
    finally { setBusy(false); if (imageRef.current) imageRef.current.value = ""; }
  }
  function clearAll() { setChat(""); setResult(null); setAiResult(""); setStatus(""); setQuery(""); }
  const exportSummary = () => {
    if (aiResult) return saveText("what-did-i-miss-summary.txt", aiResult);
    if (!result) return;
    const format = (title, items) => `${title}\n${items.length ? items.map(m => `- ${m.speaker}: ${m.text}`).join("\n") : "- None clearly identified"}\n\n`;
    const text = `WHAT DID I MISS? — SUMMARY\n\nQuick summary\n${result.quick.join("\n")}\n\n${format("Important messages", result.important)}${format("Decisions", result.decisions)}${format("Action items", result.actions)}${format("Open questions", result.questions)}`;
    saveText("what-did-i-miss-summary.txt", text);
  };

  return <div className={dark ? "app dark" : "app"}>
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); clearAll(); }}>
        <span className="brand-icon"><MessageCircle size={21}/></span>
        <span>what did i miss<span className="brand-dot">.</span><small>CHAT CATCH-UP</small></span>
      </a>
      <div className="top-actions">
        <button className="icon-button" title="Help and privacy" onClick={() => setShowHelp(v => !v)}><Info size={18}/></button>
        <button className="icon-button" title={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDark(v => !v)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
        <a className="github-link" href="https://github.com/" target="_blank" rel="noreferrer">GitHub <ArrowRight size={15}/></a>
      </div>
    </header>

    <main className="main">
      <section className="hero">
        <div className="eyebrow"><span className="pulse"/> YOUR CHAT, CAUGHT UP</div>
        <h1>Life moves fast.<br/><span>Catch up in seconds.</span></h1>
        <p className="hero-copy">Paste the chat you missed. Get the important bits, decisions, and what you need to do next — without reading every single message.</p>
        <div className="privacy-pill"><ShieldCheck size={15}/> Local-first by design <span>·</span> Your chat stays in your browser for local summaries</div>
      </section>

      {showHelp && <section className="help-panel">
        <div className="help-title"><ShieldCheck size={18}/> Privacy & how it works <button className="icon-button" onClick={() => setShowHelp(false)}><X size={16}/></button></div>
        <p><strong>Local summary:</strong> processing happens in this browser and does not send your chat to our server.</p>
        <p><strong>Screenshot OCR:</strong> text recognition runs in your browser. Review results because OCR can make mistakes.</p>
        <p><strong>AI summary:</strong> when enabled, the chat text is sent to the server you configure and then to your chosen AI provider. Do not include passwords or sensitive personal information.</p>
      </section>}

      <div className="workspace">
        <section className="input-card panel">
          <div className="card-heading">
            <div className="heading-icon violet"><Clipboard size={19}/></div>
            <div><h2>Your conversation</h2><p>Paste messages or upload a file</p></div>
            <button className="text-button" onClick={() => { setChat(SAMPLE); setResult(null); setAiResult(""); setStatus("Sample conversation loaded."); }}>Try a sample <ArrowRight size={14}/></button>
          </div>
          <label className="sr-only" htmlFor="chat-input">Paste your conversation</label>
          <textarea id="chat-input" value={chat} onChange={e => setChat(e.target.value)} placeholder={"Paste your WhatsApp, Slack, Discord, or group chat here…\n\nMaya: Are we still meeting tomorrow?\nArjun: Yes, at 2 PM. I'll send the notes."}/>
          <div className="input-meta"><span>{chat.length.toLocaleString()} characters</span><span>Up to 60,000 characters for AI mode</span></div>
          <div className="upload-row">
            <button className="upload-button" onClick={() => fileRef.current?.click()}><FileText size={16}/> Upload text file</button>
            <input ref={fileRef} type="file" accept=".txt,.md,.csv,.json,text/plain,text/csv,application/json" hidden onChange={e => handleTextFile(e.target.files?.[0])}/>
            <button className="upload-button" onClick={() => imageRef.current?.click()}><FileImage size={16}/> Read screenshot</button>
            <input ref={imageRef} type="file" accept="image/*" hidden onChange={e => handleImage(e.target.files?.[0])}/>
            <button className="clear-button" onClick={clearAll}><RotateCcw size={14}/> Clear</button>
          </div>
          <div className="mode-switch">
            <button className={mode === "local" ? "mode-option active" : "mode-option"} onClick={() => setMode("local")}><ShieldCheck size={15}/> Local summary <span>Private</span></button>
            <button className={mode === "ai" ? "mode-option active" : "mode-option"} onClick={() => setMode("ai")}><Sparkles size={15}/> AI summary <span>Advanced</span></button>
          </div>
          <button className="primary-button" disabled={busy} onClick={mode === "local" ? analyze : summarizeWithAI}>
            {busy ? <LoaderCircle className="spin" size={18}/> : mode === "local" ? <ListChecks size={18}/> : <Sparkles size={18}/>}
            {busy ? "Working…" : mode === "local" ? "Catch me up" : "Generate AI summary"}
            {!busy && <ArrowRight size={17}/>}
          </button>
          {status && <div className="status-message" role="status">{status}</div>}
          <p className="small-note"><ShieldCheck size={13}/> Never paste passwords, verification codes, or other sensitive information.</p>
        </section>

        <section className="results-area">
          {!result && !aiResult ? <div className="empty-state panel">
            <div className="empty-illustration"><div className="bubble bubble-one"><MessageCircle size={22}/></div><div className="bubble bubble-two"><Sparkles size={24}/></div><div className="bubble bubble-three"><Check size={22}/></div></div>
            <h2>Your catch-up starts here</h2>
            <p>Your summary, key decisions, and action items will appear here. Paste a chat and hit <strong>Catch me up</strong> to try it.</p>
            <div className="feature-mini-grid">
              <div><span className="mini-icon orange"><Flame size={17}/></span><strong>Key moments</strong><small>Important messages surfaced</small></div>
              <div><span className="mini-icon green"><CheckCircle2 size={17}/></span><strong>Action items</strong><small>Who needs to do what</small></div>
              <div><span className="mini-icon blue"><Sparkles size={17}/></span><strong>Less scrolling</strong><small>Get to the point faster</small></div>
            </div>
          </div> : <div className="results-stack">
            <div className="results-title">
              <div><div className="eyebrow"><span className="pulse"/> CATCH-UP REPORT</div><h2>Here's what you missed.</h2><p>{result?.count || "AI"} messages reviewed · ready for you</p></div>
              <button className="export-button" onClick={exportSummary}><ArrowDownToLine size={16}/> Export</button>
            </div>
            {aiResult ? <article className="panel ai-output"><div className="section-title"><span className="section-icon purple"><Sparkles size={17}/></span><h3>AI-powered summary</h3><span className="tag">AI</span></div><div className="markdown-lite">{aiResult.split("\n").map((line, i) => line.startsWith("## ") ? <h3 key={i}>{line.slice(3)}</h3> : line.startsWith("- ") ? <p className="md-bullet" key={i}>• {line.slice(2)}</p> : line ? <p key={i}>{line}</p> : null)}</div></article> : <>
              <article className="panel quick-card"><div className="section-title"><span className="section-icon purple"><Sparkles size={17}/></span><h3>Quick summary</h3><span className="tag">LOCAL</span></div><ul className="summary-lines">{result.quick.map((line, i) => <li key={i}>{line.replace(/^- /, "")}</li>)}</ul><p className="local-disclaimer">Basic local summary uses simple text rules; it may miss context or nuance.</p></article>
              <div className="result-grid">
                <article className="panel result-card"><div className="section-title"><span className="section-icon orange"><Flame size={17}/></span><h3>Important messages</h3><span className="count">{result.important.length}</span></div><ResultList items={result.important}/></article>
                <article className="panel result-card"><div className="section-title"><span className="section-icon green"><ListChecks size={17}/></span><h3>Action items</h3><span className="count">{result.actions.length}</span></div><ResultList items={result.actions}/></article>
                <article className="panel result-card"><div className="section-title"><span className="section-icon blue"><CheckCircle2 size={17}/></span><h3>Decisions</h3><span className="count">{result.decisions.length}</span></div><ResultList items={result.decisions}/></article>
                <article className="panel result-card"><div className="section-title"><span className="section-icon rose"><MessageCircle size={17}/></span><h3>Open questions</h3><span className="count">{result.questions.length}</span></div><ResultList items={result.questions}/></article>
              </div>
            </>}
            <article className="panel search-card">
              <div className="section-title"><span className="section-icon blue"><Search size={17}/></span><h3>Search highlights</h3></div>
              <div className="search-box"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a name, deadline, or keyword…"/></div>
              {query && <ResultList items={filteredMessages} empty="No matching highlights found."/>}
              {!query && <p className="empty">Search across important messages, action items, decisions, and questions.</p>}
            </article>
          </div>}
        </section>
      </div>
      <section className="bottom-note"><Heart size={15}/> Built to help you spend less time catching up and more time moving forward.</section>
    </main>
    <footer><span>WHAT DID I MISS?</span><span>Local-first chat catch-up · Keep your conversations yours.</span></footer>
  </div>;
}
