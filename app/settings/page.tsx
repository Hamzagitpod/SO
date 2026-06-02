"use client";
import React, { useEffect, useState } from "react";

export default function Settings() {
  const [key, setKey] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    setKey(localStorage.getItem("ccm.gemini_key") || "");
    setModel(localStorage.getItem("ccm.gemini_model") || "gemini-2.0-flash");
  }, []);
  function save() {
    localStorage.setItem("ccm.gemini_key", key.trim());
    localStorage.setItem("ccm.gemini_model", model.trim() || "gemini-2.0-flash");
    setSaved("Enregistré ✓"); setTimeout(() => setSaved(""), 1500);
  }
  return (
    <main className="wrap">
      <div className="row"><span className="tag">V3</span><strong>Réglages</strong><a className="btn btn-sm" href="/" style={{ marginLeft: "auto" }}>← Retour</a></div>
      <div className="card" style={{ maxWidth: 640 }}>
        <p className="muted">Clé <b>Gemini</b> pour l'extraction IA des menus depuis un PDF / une image. Stockée uniquement dans ton navigateur (localStorage), jamais sur le serveur. L'édition et l'export CSV V3 fonctionnent <b>sans</b> clé.</p>
        <div style={{ marginTop: 10 }}><span className="label">Clé API Gemini</span><input className="field field-mono" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" /></div>
        <div style={{ marginTop: 10 }}><span className="label">Modèle</span><input className="field field-mono" value={model} onChange={(e) => setModel(e.target.value)} placeholder="gemini-2.0-flash" /></div>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={save}>Enregistrer</button>
          <button className="btn" onClick={() => { localStorage.removeItem("ccm.gemini_key"); setKey(""); setSaved("Clé supprimée"); setTimeout(() => setSaved(""), 1500); }}>Supprimer la clé</button>
          {saved && <span className="ok tiny">{saved}</span>}
        </div>
      </div>
      <p className="muted tiny" style={{ marginTop: 16 }}>Obtenir une clé : <span className="kbd">aistudio.google.com/app/apikey</span></p>
    </main>
  );
}
