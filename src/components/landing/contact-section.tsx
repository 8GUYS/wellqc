"use client";

import { useState } from "react";
import {
  Building,
  CheckCircle2,
  Mail,
  MapPin,
  Send,
  User,
} from "lucide-react";

export function ContactSection() {
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      setFormSubmitted(false);
      setFormData({ name: "", email: "", company: "", message: "" });
    }, 4000);
  };

  return (
    <section id="contact" className="py-24 relative border-b border-wellqc-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Details */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <Mail className="w-3.5 h-3.5" />
              <span>Get in Touch</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-wellqc-text tracking-tight">
              Have Questions? Talk to Our Technical Support Team
            </h2>
            <p className="text-wellqc-muted text-base leading-relaxed">
              Whether you need assistance with raw LAS file formats, custom enterprise deployments, or pricing details, we are here to help.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-wellqc-card border border-wellqc-border shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <strong className="text-wellqc-text text-sm block font-semibold">Email Us</strong>
                  <span className="text-xs text-wellqc-muted">support@wellqcplus.com &bull; sales@wellqcplus.com</span>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-wellqc-card border border-wellqc-border shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <strong className="text-wellqc-text text-sm block font-semibold">Subsurface Engineering Hub</strong>
                  <span className="text-xs text-wellqc-muted">Port Harcourt &amp; Lagos, Nigeria &bull; Global Remote Operations</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Contact Form */}
          <div className="bg-wellqc-card rounded-2xl border border-wellqc-border p-6 sm:p-8 shadow-sm relative">
            {formSubmitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-wellqc-text">Thank You for Reaching Out!</h3>
                <p className="text-sm text-wellqc-muted">
                  Your message has been sent successfully. One of our petrophysical support engineers will respond within 2 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-wellqc-text mb-2">Send Us a Message</h3>

                <div>
                  <label className="block text-xs font-semibold text-wellqc-text mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-wellqc-muted absolute left-3 top-3.5" />
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Dr. Samuel Williams"
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-wellqc-text placeholder:text-wellqc-muted focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wellqc-text mb-1.5">
                    Work Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-wellqc-muted absolute left-3 top-3.5" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="s.williams@energycorp.com"
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-wellqc-text placeholder:text-wellqc-muted focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wellqc-text mb-1.5">
                    Company / Organization
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-wellqc-muted absolute left-3 top-3.5" />
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                      placeholder="Subsurface Energy Ltd"
                      className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-wellqc-text placeholder:text-wellqc-muted focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-wellqc-text mb-1.5">
                    Message
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us about your LAS file processing needs or questions..."
                    className="w-full bg-wellqc-panel border border-wellqc-border rounded-xl p-3 text-sm text-wellqc-text placeholder:text-wellqc-muted focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 shadow-md transition-all"
                >
                  <span>Send Message</span>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
