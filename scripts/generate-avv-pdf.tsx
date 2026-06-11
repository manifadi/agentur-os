/*
 * Vela / Agentur OS — Auftragsverarbeitungsvertrag (AVV / DPA) nach Art. 28 DSGVO
 *
 * Konstellation: Die Agentur (Auftraggeber) ist Verantwortlicher für die in Vela
 * eingepflegten personenbezogenen Daten; Vela (Auftragnehmer) ist Auftragsverarbeiter.
 *
 * - Vela Design-System (Logo, Vela Sans, Card-Pattern) — gleiche Optik wie NDA
 * - Anlage 1: Technische & organisatorische Maßnahmen (TOM)
 * - Anlage 2: Genehmigte Unterauftragsverarbeiter (Supabase, Vercel)
 *
 * Ausführen:  npx tsx scripts/generate-avv-pdf.tsx
 * Output:     ./Auftragsverarbeitungsvertrag-Vela.pdf
 */

import React from 'react';
import path from 'path';
import fs from 'fs';
import {
    Document, Page, Text, View, Image, StyleSheet, renderToFile, Font,
} from '@react-pdf/renderer';

// ─────────────────────────────────────────────────────────────
// Font registration (Vela Sans — fallback Helvetica)
// ─────────────────────────────────────────────────────────────
const FONT_DIR = path.resolve(process.cwd(), 'public/fonts/vela-sans');
let FONT_FAMILY = 'Helvetica';
try {
    Font.register({
        family: 'Vela Sans',
        fonts: [
            { src: path.join(FONT_DIR, 'VelaSans-Regular.woff2'),  fontWeight: 400 },
            { src: path.join(FONT_DIR, 'VelaSans-Medium.woff2'),   fontWeight: 500 },
            { src: path.join(FONT_DIR, 'VelaSans-SemiBold.woff2'), fontWeight: 600 },
            { src: path.join(FONT_DIR, 'VelaSans-Bold.woff2'),     fontWeight: 700 },
        ],
    });
    FONT_FAMILY = 'Vela Sans';
} catch (e) {
    console.warn('Vela Sans konnte nicht geladen werden — fallback auf Helvetica.', e);
}
Font.registerHyphenationCallback(word => [word]);

// ─────────────────────────────────────────────────────────────
// Design Tokens (identisch zur NDA)
// ─────────────────────────────────────────────────────────────
const C = {
    textPrimary:   '#111827',
    textSecondary: '#374151',
    textMuted:     '#6B7280',
    surface:       '#FFFFFF',
    subtle:        '#F5F5F7',
    borderDefault: '#E5E7EB',
    borderSubtle:  '#F3F4F6',
    accent:        '#111827',
    accentSubtle:  'rgba(17, 24, 39, 0.06)',
    success:       '#10B981',
    successSubtle: '#ECFDF5',
    successText:   '#065F46',
};

const s = StyleSheet.create({
    page: {
        backgroundColor: C.surface,
        paddingTop: 48, paddingBottom: 64, paddingHorizontal: 54,
        fontSize: 10, color: C.textPrimary, fontFamily: FONT_FAMILY, lineHeight: 1.65,
    },
    eyebrow: { fontSize: 8.5, color: C.textMuted, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' },
    h1:      { fontSize: 24, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.4, lineHeight: 1.15 },
    sectionNum:   { fontSize: 11, fontWeight: 700, color: C.accent },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: C.textPrimary },
    body:    { fontSize: 9.5, color: C.textSecondary, lineHeight: 1.65 },
    card: {
        backgroundColor: C.subtle, borderWidth: 1, borderColor: C.borderDefault,
        borderRadius: 10, padding: 14, marginBottom: 12,
    },
    footer: {
        position: 'absolute', bottom: 24, left: 54, right: 54,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 8,
    },
    footerLogo:  { width: 44, height: 13, objectFit: 'contain' },
    footerText:  { fontSize: 7.5, color: C.textMuted },
    fillLine: { borderBottomWidth: 1, borderBottomColor: C.textPrimary },
    fillCaption: { fontSize: 7.5, color: C.textMuted, marginTop: 4 },
});

const LOGO_PATH = path.resolve(process.cwd(), 'public/vela-logo.png');

const Footer = () => (
    <View style={s.footer} fixed>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {fs.existsSync(LOGO_PATH) && <Image src={LOGO_PATH} style={s.footerLogo} />}
            <Text style={s.footerText}>Auftragsverarbeitungsvertrag (Art. 28 DSGVO) · Vela / Agentur OS</Text>
        </View>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
);

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────
const Section = ({ num, title, children }: { num: string; title: string; children: React.ReactNode }) => (
    <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 7 }} wrap={false} minPresenceAhead={48}>
            <Text style={s.sectionNum}>§ {num}</Text>
            <Text style={s.sectionTitle}>{title}</Text>
        </View>
        {children}
    </View>
);

const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={[s.body, { marginBottom: 6 }]}>{children}</Text>
);

const Li = ({ marker, children }: { marker: string; children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }} wrap={false}>
        <Text style={[s.body, { width: 16, color: C.textPrimary, fontWeight: 700 }]}>{marker}</Text>
        <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
);

const Fill = ({ caption, width = '100%', mt = 0 }: { caption: string; width?: any; mt?: number }) => (
    <View style={{ width, marginTop: mt }}>
        <View style={[s.fillLine, { height: 22 }]} />
        <Text style={s.fillCaption}>{caption}</Text>
    </View>
);

// Anlage heading (für Anhänge)
const AnlageHead = ({ label, title }: { label: string; title: string }) => (
    <View style={{ marginBottom: 16 }}>
        <Text style={[s.eyebrow, { marginBottom: 6 }]}>{label}</Text>
        <Text style={s.h1}>{title}</Text>
        <View style={{ height: 2, backgroundColor: C.accent, marginTop: 12 }} />
    </View>
);

// ─────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────
const Doc = () => (
    <Document
        title="Auftragsverarbeitungsvertrag — Vela / Agentur OS"
        author="Vela / Agentur OS"
        subject="Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO"
    >
        {/* ── PAGE 1: HEADER + PARTEIEN ── */}
        <Page size="A4" style={s.page}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                <View>
                    <Text style={[s.eyebrow, { marginBottom: 10 }]}>Datenschutz · Art. 28 DSGVO</Text>
                    <Text style={s.h1}>Auftrags-{'\n'}verarbeitungsvertrag</Text>
                </View>
                {fs.existsSync(LOGO_PATH) && (
                    <Image src={LOGO_PATH} style={{ width: 78, height: 23, objectFit: 'contain', marginTop: 4 }} />
                )}
            </View>

            <View style={{ height: 2, backgroundColor: C.accent, marginBottom: 18 }} />

            <Text style={[s.body, { marginBottom: 10 }]}>
                Dieser Auftragsverarbeitungsvertrag (nachfolgend „AVV") konkretisiert die datenschutzrechtlichen
                Pflichten der Parteien im Rahmen der Nutzung der Software „Vela / Agentur OS". Er wird geschlossen
                zwischen
            </Text>

            <View style={s.card}>
                <Text style={[s.eyebrow, { marginBottom: 8 }]}>Auftraggeber · Verantwortlicher</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                    <Fill caption="Name der Agentur / des Unternehmens" width="48%" />
                    <Fill caption="Vertreten durch (Name, Funktion)" width="48%" />
                </View>
                <View style={{ marginTop: 14 }}>
                    <Fill caption="Anschrift (Straße, PLZ, Ort)" />
                </View>
                <Text style={[s.body, { marginTop: 10, fontSize: 9 }]}>
                    – nachfolgend „Auftraggeber" oder „Verantwortlicher" genannt –
                </Text>
            </View>

            <Text style={[s.body, { marginBottom: 10 }]}>und</Text>

            <View style={s.card}>
                <Text style={[s.eyebrow, { marginBottom: 8 }]}>Auftragnehmer · Auftragsverarbeiter</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                    <Fill caption="Vor- und Nachname / Firma" width="48%" />
                    <Fill caption="Produkt: Vela / Agentur OS" width="48%" />
                </View>
                <View style={{ marginTop: 14 }}>
                    <Fill caption="Anschrift (Straße, PLZ, Ort)" />
                </View>
                <Text style={[s.body, { marginTop: 10, fontSize: 9 }]}>
                    – nachfolgend „Auftragnehmer" oder „Auftragsverarbeiter" genannt –
                </Text>
            </View>

            <Text style={[s.body, { marginTop: 6 }]}>
                Der Auftraggeber verarbeitet mithilfe der Software personenbezogene Daten und ist hierfür
                datenschutzrechtlich Verantwortlicher. Der Auftragnehmer verarbeitet diese Daten ausschließlich
                weisungsgebunden im Auftrag des Auftraggebers. Dieser AVV regelt die Rechte und Pflichten der
                Parteien gemäß Art. 28 DSGVO.
            </Text>

            <Footer />
        </Page>

        {/* ── PARAGRAPHEN (fließend) ── */}
        <Page size="A4" style={s.page}>
            <Section num="1" title="Gegenstand, Dauer und Spezifizierung der Verarbeitung">
                <P>
                    (1) Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten durch den Auftragnehmer
                    im Rahmen der Bereitstellung und des Betriebs der Software „Vela / Agentur OS" (SaaS) für den
                    Auftraggeber.
                </P>
                <P>
                    (2) Die Dauer dieses AVV richtet sich nach der Laufzeit des zugrunde liegenden Nutzungs- bzw.
                    Test-/Pilotverhältnisses und endet mit dessen Beendigung. Die Pflichten zur Löschung und
                    Rückgabe (§ 9) bestehen über das Vertragsende hinaus fort.
                </P>
                <P>
                    (3) Art, Umfang, Zweck der Verarbeitung, die Art der personenbezogenen Daten sowie die Kategorien
                    betroffener Personen ergeben sich aus § 2 und werden in Anlage 1 nicht abschließend konkretisiert.
                </P>
            </Section>

            <Section num="2" title="Art der Daten und Kategorien betroffener Personen">
                <P>(1) Im Rahmen der Nutzung werden insbesondere folgende Arten personenbezogener Daten verarbeitet:</P>
                <Li marker="a)">Stammdaten (Name, Anschrift, Kontaktdaten) von Mitarbeitenden des Auftraggebers und dessen Kunden;</Li>
                <Li marker="b)">Projekt-, Aufgaben- und Zeiterfassungsdaten, Leistungs- und Tätigkeitsnachweise;</Li>
                <Li marker="c)">Kalkulations-, Angebots-, Rechnungs- und Abrechnungsdaten;</Li>
                <Li marker="d)">Kalender- und Termindaten sowie ggf. damit verbundene Kommunikationsdaten;</Li>
                <Li marker="e)">Zugangs-, Nutzungs- und Protokolldaten der Software.</Li>
                <P>(2) Kategorien betroffener Personen sind insbesondere:</P>
                <Li marker="a)">Mitarbeitende, Geschäftsführung und freie Mitarbeitende des Auftraggebers;</Li>
                <Li marker="b)">Kunden, Interessenten und Ansprechpartner des Auftraggebers;</Li>
                <Li marker="c)">sonstige Geschäftspartner, deren Daten der Auftraggeber in der Software verarbeitet.</Li>
                <P>
                    (3) Zweck der Verarbeitung ist ausschließlich die Erbringung der vertraglich vereinbarten
                    Software-Leistungen. Eine Verarbeitung zu eigenen Zwecken des Auftragnehmers findet nicht statt.
                </P>
            </Section>

            <Section num="3" title="Weisungsgebundenheit">
                <P>
                    (1) Der Auftragnehmer verarbeitet personenbezogene Daten ausschließlich im Rahmen der getroffenen
                    Vereinbarungen und nach dokumentierter Weisung des Auftraggebers, es sei denn, er ist gesetzlich
                    zur Verarbeitung verpflichtet. In diesem Fall teilt er dem Auftraggeber diese rechtlichen
                    Anforderungen vor der Verarbeitung mit, soweit dies rechtlich zulässig ist.
                </P>
                <P>
                    (2) Weisungen werden in der Regel in Textform erteilt. Mündliche Weisungen sind unverzüglich in
                    Textform zu bestätigen.
                </P>
                <P>
                    (3) Ist der Auftragnehmer der Ansicht, dass eine Weisung gegen datenschutzrechtliche Vorschriften
                    verstößt, hat er den Auftraggeber unverzüglich darauf hinzuweisen. Er ist berechtigt, die
                    Durchführung der betreffenden Weisung bis zu deren Bestätigung oder Änderung auszusetzen.
                </P>
            </Section>

            <Section num="4" title="Technische und organisatorische Maßnahmen (TOM)">
                <P>
                    (1) Der Auftragnehmer trifft die nach Art. 32 DSGVO erforderlichen technischen und
                    organisatorischen Maßnahmen, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten. Die
                    aktuell getroffenen Maßnahmen sind in Anlage 1 beschrieben.
                </P>
                <P>
                    (2) Die Maßnahmen können im Verlauf des Vertragsverhältnisses fortentwickelt und angepasst werden,
                    dürfen das vereinbarte Schutzniveau jedoch nicht unterschreiten. Wesentliche Änderungen sind zu
                    dokumentieren.
                </P>
            </Section>

            <Section num="5" title="Unterauftragsverarbeiter">
                <P>
                    (1) Der Auftraggeber stimmt dem Einsatz der in Anlage 2 genannten Unterauftragsverarbeiter zu.
                    Diese werden insbesondere für Hosting und Infrastruktur eingesetzt.
                </P>
                <P>
                    (2) Eine Änderung oder Hinzunahme weiterer Unterauftragsverarbeiter ist zulässig, sofern der
                    Auftragnehmer den Auftraggeber rechtzeitig vorab informiert und der Auftraggeber nicht innerhalb
                    einer angemessenen Frist aus wichtigem datenschutzrechtlichem Grund widerspricht.
                </P>
                <P>
                    (3) Der Auftragnehmer verpflichtet die Unterauftragsverarbeiter vertraglich auf ein
                    Datenschutzniveau, das diesem AVV entspricht. Erfolgt eine Verarbeitung in einem Drittland, stellt
                    der Auftragnehmer geeignete Garantien nach Art. 44 ff. DSGVO sicher (z. B. EU-Standardvertrags­klauseln).
                </P>
            </Section>

            <Section num="6" title="Unterstützung des Verantwortlichen / Betroffenenrechte">
                <P>
                    (1) Der Auftragnehmer unterstützt den Auftraggeber im Rahmen seiner Möglichkeiten bei der
                    Erfüllung der Rechte betroffener Personen (Auskunft, Berichtigung, Löschung, Einschränkung,
                    Datenübertragbarkeit, Widerspruch) sowie bei Datenschutz-Folgenabschätzungen und vorherigen
                    Konsultationen nach Art. 35, 36 DSGVO.
                </P>
                <P>
                    (2) Wendet sich eine betroffene Person unmittelbar an den Auftragnehmer, leitet dieser das Anliegen
                    unverzüglich an den Auftraggeber weiter und beantwortet es nicht selbst.
                </P>
            </Section>

            <Section num="7" title="Meldung von Verletzungen des Schutzes personenbezogener Daten">
                <P>
                    (1) Der Auftragnehmer meldet dem Auftraggeber jede ihm bekannt gewordene Verletzung des Schutzes
                    personenbezogener Daten unverzüglich, spätestens jedoch innerhalb von 48 Stunden nach Kenntnis.
                </P>
                <P>
                    (2) Die Meldung enthält mindestens eine Beschreibung der Art der Verletzung, die betroffenen
                    Datenkategorien, die wahrscheinlichen Folgen sowie die ergriffenen bzw. vorgeschlagenen Maßnahmen.
                    Der Auftragnehmer unterstützt den Auftraggeber bei dessen Melde- und Benachrichtigungspflichten
                    nach Art. 33, 34 DSGVO.
                </P>
            </Section>

            <Section num="8" title="Kontrollrechte und Nachweise">
                <P>
                    (1) Der Auftragnehmer stellt dem Auftraggeber alle erforderlichen Informationen zum Nachweis der
                    Einhaltung der Pflichten aus Art. 28 DSGVO zur Verfügung und ermöglicht Überprüfungen.
                </P>
                <P>
                    (2) Kontrollen erfolgen mit angemessener Vorankündigung, während der üblichen Geschäftszeiten und
                    ohne vermeidbare Störung des Betriebsablaufs. Der Nachweis kann auch durch geeignete Zertifikate,
                    Testate oder Berichte unabhängiger Dritter geführt werden.
                </P>
            </Section>

            <Section num="9" title="Löschung und Rückgabe nach Beendigung">
                <P>
                    (1) Nach Abschluss der Verarbeitungstätigkeiten löscht der Auftragnehmer nach Wahl des
                    Auftraggebers sämtliche personenbezogenen Daten oder gibt sie zurück, sofern keine gesetzliche
                    Aufbewahrungspflicht besteht.
                </P>
                <P>
                    (2) Bestehende Sicherungskopien werden im Rahmen der regulären Backup-Zyklen gelöscht. Die Löschung
                    ist dem Auftraggeber auf Verlangen in Textform zu bestätigen.
                </P>
            </Section>

            <Section num="10" title="Haftung und Schlussbestimmungen">
                <P>
                    (1) Für die Haftung gelten die gesetzlichen Bestimmungen, insbesondere Art. 82 DSGVO. Im Verhältnis
                    der Parteien gehen die Regelungen des zugrunde liegenden Hauptvertrags vor, soweit dieser AVV keine
                    abweichende Regelung trifft.
                </P>
                <P>
                    (2) Bei Widersprüchen zwischen diesem AVV und sonstigen Vereinbarungen gehen die Regelungen dieses
                    AVV in datenschutzrechtlichen Fragen vor.
                </P>
                <P>
                    (3) Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik
                    Deutschland. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen
                    Bestimmungen unberührt.
                </P>
            </Section>

            {/* Signatures */}
            <View style={{ marginTop: 18 }} wrap={false}>
                <Text style={[s.eyebrow, { marginBottom: 16 }]}>Unterschriften</Text>
                <View style={{ marginBottom: 20 }}>
                    <Fill caption="Ort, Datum" width="60%" />
                </View>
                <View style={{ flexDirection: 'row', gap: 28 }}>
                    <View style={{ flex: 1 }}>
                        <View style={[s.fillLine, { height: 34 }]} />
                        <Text style={[s.fillCaption, { fontWeight: 700, color: C.textPrimary }]}>Auftraggeber · Verantwortlicher</Text>
                        <Text style={s.fillCaption}>Name in Druckbuchstaben · Funktion</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={[s.fillLine, { height: 34 }]} />
                        <Text style={[s.fillCaption, { fontWeight: 700, color: C.textPrimary }]}>Auftragnehmer · Auftragsverarbeiter</Text>
                        <Text style={s.fillCaption}>Vela / Agentur OS · Name in Druckbuchstaben</Text>
                    </View>
                </View>
            </View>

            <Footer />
        </Page>

        {/* ── ANLAGE 1: TOM ── */}
        <Page size="A4" style={s.page}>
            <AnlageHead label="Anlage 1" title="Technische & organisatorische Maßnahmen" />

            <P>
                Nachfolgende Maßnahmen nach Art. 32 DSGVO gewährleisten ein dem Risiko angemessenes Schutzniveau.
                Sie spiegeln den aktuellen Stand wider und werden fortlaufend überprüft.
            </P>

            <View style={s.card}>
                <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Vertraulichkeit</Text>
                <Li marker="•">Mandantentrennung: jede Agentur erhält eine logisch getrennte Datenbasis (Multi-Tenant-Architektur mit zeilenbasierter Zugriffskontrolle / Row Level Security).</Li>
                <Li marker="•">Zugriffskontrolle: rollenbasierte Rechte, individuelle Benutzerkonten, keine geteilten Zugänge.</Li>
                <Li marker="•">Verschlüsselung sensibler Zugangsdaten (z. B. Kalender-Tokens) mit AES-256-GCM in der Datenbank.</Li>
                <Li marker="•">Transportverschlüsselung (TLS/HTTPS) für sämtliche Verbindungen.</Li>
            </View>

            <View style={s.card}>
                <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Integrität & Verfügbarkeit</Text>
                <Li marker="•">Regelmäßige automatisierte Backups; Wiederherstellbarkeit der Daten.</Li>
                <Li marker="•">Betrieb auf Infrastruktur etablierter Anbieter mit anerkannten Sicherheitszertifizierungen (siehe Anlage 2).</Li>
                <Li marker="•">Protokollierung sicherheitsrelevanter Vorgänge (Audit-Log) im Administrationsbereich.</Li>
                <Li marker="•">Trennung von Test-/Pilot- und Produktivumgebung, soweit eingesetzt.</Li>
            </View>

            <View style={s.card}>
                <Text style={[s.sectionTitle, { marginBottom: 8 }]}>Belastbarkeit & Verfahren</Text>
                <Li marker="•">Verfahren zur regelmäßigen Überprüfung, Bewertung und Evaluierung der Wirksamkeit der Maßnahmen.</Li>
                <Li marker="•">Verpflichtung der eingesetzten Personen auf Vertraulichkeit.</Li>
                <Li marker="•">Datenminimierung: Erhebung nur der für den Zweck erforderlichen Daten.</Li>
            </View>

            <Text style={[s.body, { fontSize: 8.5, color: C.textMuted, marginTop: 4 }]}>
                Hinweis: Diese Aufstellung ist vor produktivem Einsatz an den tatsächlichen technischen Stand und das
                gewählte Hosting-Setup anzupassen.
            </Text>

            <Footer />
        </Page>

        {/* ── ANLAGE 2: SUBPROZESSOREN ── */}
        <Page size="A4" style={s.page}>
            <AnlageHead label="Anlage 2" title="Genehmigte Unterauftragsverarbeiter" />

            <P>
                Der Auftragnehmer setzt zum Zeitpunkt des Vertragsschlusses folgende Unterauftragsverarbeiter ein.
                Der Auftraggeber stimmt deren Einsatz gemäß § 5 zu.
            </P>

            <View style={s.card}>
                <Text style={[s.sectionTitle]}>Supabase</Text>
                <Text style={[s.body, { marginTop: 4 }]}>
                    Datenbank-Hosting (PostgreSQL), Authentifizierung und Realtime-Infrastruktur. Leistung:
                    Speicherung und Bereitstellung der Anwendungsdaten.
                </Text>
                <Text style={[s.body, { marginTop: 4, fontSize: 8.5, color: C.textMuted }]}>
                    Hosting-Region und Auftragsverarbeitungsvereinbarung des Anbieters vor produktivem Einsatz prüfen
                    (EU-Region wählen).
                </Text>
            </View>

            <View style={s.card}>
                <Text style={[s.sectionTitle]}>Vercel</Text>
                <Text style={[s.body, { marginTop: 4 }]}>
                    Hosting und Auslieferung der Webanwendung (Frontend/Serverless-Funktionen). Leistung: Betrieb der
                    Anwendung.
                </Text>
                <Text style={[s.body, { marginTop: 4, fontSize: 8.5, color: C.textMuted }]}>
                    Hosting-Region und Auftragsverarbeitungsvereinbarung des Anbieters vor produktivem Einsatz prüfen.
                </Text>
            </View>

            <View style={[s.card, { backgroundColor: C.successSubtle, borderColor: 'rgba(16,185,129,0.25)' }]}>
                <Text style={[s.sectionTitle, { color: C.successText }]}>Optionale, vom Nutzer ausgelöste Dienste</Text>
                <Text style={[s.body, { marginTop: 4 }]}>
                    Bei aktiver Kalender-Synchronisation: Google bzw. Microsoft (nur wenn der Auftraggeber die
                    Verbindung selbst einrichtet). Diese Verarbeitung erfolgt auf ausdrückliche Veranlassung des
                    Auftraggebers.
                </Text>
            </View>

            <View style={{ marginTop: 4 }}>
                <Text style={[s.eyebrow, { marginBottom: 10 }]}>Weitere Unterauftragsverarbeiter (manuell ergänzen)</Text>
                <Fill caption="Name · Leistung · Hosting-Region" mt={6} />
                <Fill caption="Name · Leistung · Hosting-Region" mt={18} />
            </View>

            <Footer />
        </Page>
    </Document>
);

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────
const OUTPUT = `${process.cwd()}/Auftragsverarbeitungsvertrag-Vela.pdf`;

(async () => {
    console.log('Rendering Vela AVV PDF…');
    await renderToFile(<Doc />, OUTPUT);
    console.log(`PDF written: ${OUTPUT}`);
})();
