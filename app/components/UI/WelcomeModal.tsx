'use client';

import React, { useState } from 'react';
import { Layers, CheckSquare, Clock, ArrowRight, X } from 'lucide-react';

interface WelcomeModalProps {
    userName: string;
    onDismiss: () => void;
}

const STEPS = [
    {
        icon: Layers,
        color: 'text-accent bg-accent/10',
        title: 'Projekte & Kunden',
        body: 'Verwalte alle Projekte deiner Agentur. Status, Deadline, Kalkulation und Aufgaben — alles an einem Ort.',
    },
    {
        icon: CheckSquare,
        color: 'text-green-500 bg-green-500/10',
        title: 'Aufgaben & Todos',
        body: 'Weise Aufgaben zu, setze Deadlines und verfolge den Fortschritt. Direkt im Projekt oder in der globalen Aufgabenliste.',
    },
    {
        icon: Clock,
        color: 'text-violet-500 bg-violet-500/10',
        title: 'Zeiterfassung',
        body: 'Erfasse Stunden pro Projekt und Mitarbeiter. Ressourcenplanung und Berichte zeigen dir wer womit beschäftigt ist.',
    },
];

export default function WelcomeModal({ userName, onDismiss }: WelcomeModalProps) {
    const [step, setStep] = useState(0);
    const isLast = step === STEPS.length - 1;
    const isIntro = step === -1;

    const firstName = userName.split(' ')[0];

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-surface rounded-3xl shadow-2xl max-w-md w-full p-8 border border-default animate-in zoom-in-95 duration-300 relative overflow-hidden">

                {/* Subtle background accent */}
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-accent/5 pointer-events-none" />

                <button
                    onClick={onDismiss}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-text-muted hover:bg-hover transition"
                >
                    <X size={16} />
                </button>

                {step === -1 ? (
                    /* Intro screen */
                    <div className="text-center py-2">
                        <div className="text-5xl mb-5">👋</div>
                        <h1 className="text-2xl font-bold text-text-primary mb-2">Willkommen, {firstName}!</h1>
                        <p className="text-text-muted text-sm mb-8 leading-relaxed">
                            Schön dass du dabei bist. Lass uns in 30 Sekunden durch die wichtigsten Features führen.
                        </p>
                        <button
                            onClick={() => setStep(0)}
                            className="w-full bg-accent text-surface py-3 rounded-xl font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
                        >
                            Los geht's <ArrowRight size={16} />
                        </button>
                        <button onClick={onDismiss} className="block mt-3 mx-auto text-xs text-text-placeholder hover:text-text-muted transition">
                            Überspringen
                        </button>
                    </div>
                ) : (
                    /* Feature steps */
                    <div>
                        {/* Progress dots */}
                        <div className="flex gap-1.5 justify-center mb-8">
                            {STEPS.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-accent' : i < step ? 'w-3 bg-accent/30' : 'w-3 bg-border-default'}`}
                                />
                            ))}
                        </div>

                        {/* Step content */}
                        <div className="text-center mb-8">
                            {(() => {
                                const { icon: Icon, color, title, body } = STEPS[step];
                                return (
                                    <>
                                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${color}`}>
                                            <Icon size={28} />
                                        </div>
                                        <h2 className="text-xl font-bold text-text-primary mb-2">{title}</h2>
                                        <p className="text-text-muted text-sm leading-relaxed">{body}</p>
                                    </>
                                );
                            })()}
                        </div>

                        <div className="flex gap-3">
                            {step > 0 && (
                                <button
                                    onClick={() => setStep(s => s - 1)}
                                    className="flex-1 py-2.5 rounded-xl border border-default text-sm font-bold text-text-primary hover:bg-hover transition"
                                >
                                    Zurück
                                </button>
                            )}
                            <button
                                onClick={() => isLast ? onDismiss() : setStep(s => s + 1)}
                                className="flex-1 py-2.5 rounded-xl bg-accent text-surface text-sm font-bold hover:opacity-90 transition flex items-center justify-center gap-2"
                            >
                                {isLast ? 'Fertig' : <>Weiter <ArrowRight size={14} /></>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
