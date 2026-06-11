/*
 * Vela / Agentur OS — Verschwiegenheits- & Vertraulichkeitsvereinbarung (NDA)
 *
 * Maßgeschneidert für: Pilot-/Test-Betrieb der Software Vela durch eine
 * potentielle Test-Agentur. Schutz von IP, Konzept, Code, Design + Nachbau-Verbot.
 *
 * - Vela Design-System (Farben, Typo, Card-Pattern)
 * - Logo auf Cover + Footer
 * - Ausfüllbare Unterschriften & Parteien-Blöcke
 *
 * Ausführen:  npx tsx scripts/generate-nda-pdf.tsx
 * Output:     ./Verschwiegenheitserklaerung-Vela.pdf
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
// Design Tokens
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
    dangerSubtle:  '#FEF2F2',
    dangerText:    '#991B1B',
    dangerBorder:  'rgba(239, 68, 68, 0.25)',
};

const s = StyleSheet.create({
    page: {
        backgroundColor: C.surface,
        paddingTop: 48,
        paddingBottom: 64,
        paddingHorizontal: 54,
        fontSize: 10,
        color: C.textPrimary,
        fontFamily: FONT_FAMILY,
        lineHeight: 1.55,
    },

    eyebrow: { fontSize: 8.5, color: C.textMuted, fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase' },
    h1:      { fontSize: 24, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.4, lineHeight: 1.15 },

    // Paragraph (§) heading
    sectionNum:   { fontSize: 11, fontWeight: 700, color: C.accent },
    sectionTitle: { fontSize: 11, fontWeight: 700, color: C.textPrimary },

    body:    { fontSize: 9.5, color: C.textSecondary, lineHeight: 1.65 },

    // Card
    card: {
        backgroundColor: C.subtle,
        borderWidth: 1, borderColor: C.borderDefault,
        borderRadius: 10, padding: 14, marginBottom: 12,
    },

    // Footer
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
            <Text style={s.footerText}>Vertraulichkeitsvereinbarung · Vela / Agentur OS · Streng vertraulich</Text>
        </View>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
);

// ─────────────────────────────────────────────────────────────
// § Section component
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

// Numbered / lettered list item — wrap={false} verhindert, dass Marker und Text
// über einen Seitenumbruch zerrissen werden (a) oben, Text erst auf nächster Seite).
const Li = ({ marker, children }: { marker: string; children: React.ReactNode }) => (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }} wrap={false}>
        <Text style={[s.body, { width: 16, color: C.textPrimary, fontWeight: 700 }]}>{marker}</Text>
        <Text style={[s.body, { flex: 1 }]}>{children}</Text>
    </View>
);

// Fillable underline field
const Fill = ({ caption, width = '100%', mt = 0 }: { caption: string; width?: any; mt?: number }) => (
    <View style={{ width, marginTop: mt }}>
        <View style={[s.fillLine, { height: 22 }]} />
        <Text style={s.fillCaption}>{caption}</Text>
    </View>
);

// ─────────────────────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────────────────────
const Doc = () => (
    <Document
        title="Verschwiegenheitserklärung — Vela / Agentur OS"
        author="Vela / Agentur OS"
        subject="Vertraulichkeitsvereinbarung (NDA) für den Pilot-/Testbetrieb"
    >
        {/* ── PAGE 1 ── */}
        <Page size="A4" style={s.page}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                <View>
                    <Text style={[s.eyebrow, { marginBottom: 10 }]}>Vertraulichkeitsvereinbarung · NDA</Text>
                    <Text style={s.h1}>Verschwiegenheits- &{'\n'}Geheimhaltungserklärung</Text>
                </View>
                {fs.existsSync(LOGO_PATH) && (
                    <Image src={LOGO_PATH} style={{ width: 78, height: 23, objectFit: 'contain', marginTop: 4 }} />
                )}
            </View>

            <View style={{ height: 2, backgroundColor: C.accent, marginBottom: 18 }} />

            {/* Parties */}
            <Text style={[s.body, { marginBottom: 10 }]}>Diese Vereinbarung wird geschlossen zwischen</Text>

            <View style={s.card}>
                <Text style={[s.eyebrow, { marginBottom: 8 }]}>Offenlegende Partei</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                    <Fill caption="Vor- und Nachname" width="48%" />
                    <Fill caption="Projekt / Produkt: Vela / Agentur OS" width="48%" />
                </View>
                <View style={{ marginTop: 14 }}>
                    <Fill caption="Anschrift (Straße, PLZ, Ort)" />
                </View>
                <Text style={[s.body, { marginTop: 10, fontSize: 9 }]}>
                    – nachfolgend „Offenlegende Partei" bzw. „Vela" genannt –
                </Text>
            </View>

            <Text style={[s.body, { marginBottom: 10 }]}>und</Text>

            <View style={s.card}>
                <Text style={[s.eyebrow, { marginBottom: 8 }]}>Empfangende Partei</Text>
                <View style={{ flexDirection: 'row', gap: 18 }}>
                    <Fill caption="Name der Agentur / des Unternehmens" width="48%" />
                    <Fill caption="Vertreten durch (Name, Funktion)" width="48%" />
                </View>
                <View style={{ marginTop: 14 }}>
                    <Fill caption="Anschrift (Straße, PLZ, Ort)" />
                </View>
                <Text style={[s.body, { marginTop: 10, fontSize: 9 }]}>
                    – nachfolgend „Empfangende Partei" genannt –
                </Text>
            </View>

            <Text style={[s.body, { marginTop: 6 }]}>
                Die Parteien beabsichtigen, im Rahmen eines persönlichen Gesprächs sowie eines anschließenden
                Test- bzw. Pilotbetriebs der Software „Vela / Agentur OS" zusammenzuarbeiten. Hierbei erhält die
                Empfangende Partei Zugang zu vertraulichen Informationen und Geschäftsgeheimnissen der
                Offenlegenden Partei. Zu deren Schutz vereinbaren die Parteien Folgendes:
            </Text>

            <Footer />
        </Page>

        {/* ── PARAGRAPHS (fließend, auto-paginiert) ── */}
        <Page size="A4" style={s.page}>
            <Section num="1" title="Gegenstand und Zweck der Vereinbarung">
                <P>
                    (1) Die Offenlegende Partei entwickelt mit „Vela / Agentur OS" eine integrierte All-in-One-Software
                    für Kreativagenturen (Projekt- und Aufgabenverwaltung, Zeiterfassung, Ressourcenplanung,
                    Kalkulation, Angebote/Rechnungen, Kalender u. a.). Im Rahmen eines Gesprächs am
                </P>
                <View style={{ flexDirection: 'row', gap: 18, marginVertical: 4 }}>
                    <Fill caption="Datum des Gesprächs" width="48%" />
                    <Fill caption="Ort" width="48%" />
                </View>
                <P>
                    sowie eines daran ggf. anschließenden Test- und Pilotbetriebs werden der Empfangenden Partei
                    vertrauliche Informationen mündlich, schriftlich, elektronisch, durch Vorführung der Software,
                    durch Bereitstellung von Zugangsdaten zu einer Test-/Produktivinstanz oder in sonstiger Form
                    zugänglich gemacht.
                </P>
                <P>
                    (2) Die Empfangende Partei verpflichtet sich, diese Informationen ausschließlich für die
                    Bewertung und den vereinbarten Testeinsatz der Software zu verwenden und im Übrigen nach
                    Maßgabe dieser Vereinbarung streng vertraulich zu behandeln.
                </P>
            </Section>

            <Section num="2" title="Vertrauliche Informationen">
                <P>
                    (1) Als „vertrauliche Informationen" gelten sämtliche Inhalte, Daten, Unterlagen und Mitteilungen,
                    die der Empfangenden Partei vor, während oder nach dem Gespräch bzw. im Rahmen des Testbetriebs
                    bekannt werden – unabhängig davon, ob sie ausdrücklich als „vertraulich" gekennzeichnet sind oder
                    nicht. Hierzu zählen insbesondere:
                </P>
                <Li marker="a)">die Software selbst, ihr Quellcode, ihre Architektur, Datenmodelle, Algorithmen, Schnittstellen und technischen Funktionsweisen;</Li>
                <Li marker="b)">die Benutzeroberfläche, das Design, das Design-System, Layouts, Bedienkonzepte, Screens, Workflows und das Look-and-Feel;</Li>
                <Li marker="c)">das zugrunde liegende Produkt- und Geschäftskonzept, insbesondere der integrierte All-in-One-Ansatz, dessen Aufbau, Modulkombination und Zusammenspiel;</Li>
                <Li marker="d)">Konzepte, Ideen, Know-how, Roadmaps, geplante Funktionen, Strategien, Preismodelle, Kennzahlen sowie Geschäfts- und Betriebsgeheimnisse;</Li>
                <Li marker="e)">Zugangsdaten, Logins, Demo- und Testdaten sowie alle Screenshots, Bildschirm- oder Videoaufnahmen der Software.</Li>
                <P>
                    (2) Vertraulich sind ferner sämtliche Erkenntnisse, die sich erst aus der Zusammenschau oder
                    Analyse offengelegter Einzelinformationen ergeben.
                </P>
            </Section>

            <Section num="3" title="Pflichten der Empfangenden Partei">
                <P>Die Empfangende Partei verpflichtet sich,</P>
                <Li marker="a)">die vertraulichen Informationen streng geheim zu halten und Dritten weder ganz noch teilweise zugänglich zu machen, mitzuteilen oder zu überlassen;</Li>
                <Li marker="b)">die Informationen ausschließlich für den in § 1 genannten Zweck zu verwenden und nicht für eigene oder fremde geschäftliche, wirtschaftliche, berufliche oder private Vorhaben zu nutzen oder zu verwerten;</Li>
                <Li marker="c)">den Zugang zu den Informationen auf solche Mitarbeiter zu beschränken, die ihn zwingend benötigen, und diese in gleichem Umfang zur Vertraulichkeit zu verpflichten;</Li>
                <Li marker="d)">alle angemessenen technischen und organisatorischen Vorkehrungen gegen eine unbefugte Kenntnisnahme durch Dritte zu treffen;</Li>
                <Li marker="e)">ohne vorherige schriftliche Zustimmung der Offenlegenden Partei keine Screenshots, Foto-, Bildschirm- oder Videoaufnahmen der Software anzufertigen oder weiterzugeben;</Li>
                <Li marker="f)">Aufzeichnungen, Kopien, Notizen, Daten und Zugangsdaten auf Verlangen der Offenlegenden Partei oder bei Beendigung des Testbetriebs unverzüglich zurückzugeben bzw. nachweislich und vollständig zu löschen oder zu vernichten.</Li>
            </Section>

            <Section num="4" title="Geistiges Eigentum — keine Rechteübertragung">
                <P>
                    (1) Sämtliche Rechte an der Software, am Quellcode, am Design, an den Konzepten, am Know-how und
                    an allen sonstigen vertraulichen Informationen verbleiben ausschließlich bei der Offenlegenden
                    Partei. Diese Vereinbarung begründet keinerlei Übertragung, Lizenz oder sonstiges Nutzungsrecht
                    an diesen Rechten, mit Ausnahme des für den vereinbarten Testbetrieb erforderlichen,
                    nicht-exklusiven, jederzeit widerruflichen Nutzungsrechts.
                </P>
                <P>
                    (2) Die Offenlegung vertraulicher Informationen begründet kein Vorbenutzungsrecht und keinen
                    Anspruch der Empfangenden Partei auf deren Verwertung.
                </P>
                <P>
                    (3) Rückmeldungen, Verbesserungsvorschläge oder Ideen, die die Empfangende Partei im Rahmen des
                    Testbetriebs zur Software beisteuert, darf die Offenlegende Partei unentgeltlich, zeitlich und
                    räumlich unbeschränkt für die Weiterentwicklung der Software nutzen, ohne dass hieraus Ansprüche
                    der Empfangenden Partei entstehen.
                </P>
            </Section>

            <Section num="5" title="Nachbau-, Kopier- und Reverse-Engineering-Verbot">
                <P>Die Empfangende Partei verpflichtet sich, es zu unterlassen,</P>
                <Li marker="a)">die Software oder Teile davon ganz oder teilweise nachzubauen, zu kopieren, nachzuahmen oder nachbilden zu lassen — einschließlich des Produktkonzepts, des integrierten All-in-One-Ansatzes, der Benutzeroberfläche, des Designs und der Bedienabläufe;</Li>
                <Li marker="b)">die Software zu dekompilieren, zu disassemblieren, einem Reverse Engineering zu unterziehen oder auf andere Weise den Quellcode, die Strukturen oder Funktionsweisen zu ermitteln, soweit dies nicht zwingend gesetzlich erlaubt ist;</Li>
                <Li marker="c)">unter Verwendung der vertraulichen Informationen ein konkurrierendes oder gleichartiges Produkt selbst zu entwickeln, entwickeln zu lassen, zu finanzieren oder dessen Entwicklung durch Dritte zu fördern oder zu beauftragen;</Li>
                <Li marker="d)">vertrauliche Informationen an gegenwärtige oder potentielle Wettbewerber der Offenlegenden Partei weiterzugeben.</Li>
                <P>
                    Dieses Verbot gilt unabhängig davon, ob die Empfangende Partei die Informationen für „neu" oder
                    „allgemein bekannt" hält.
                </P>
            </Section>

            <Section num="6" title="Ausnahmen von der Geheimhaltung">
                <P>Die Geheimhaltungspflicht gilt nicht für Informationen, die</P>
                <Li marker="a)">zum Zeitpunkt der Offenlegung bereits allgemein öffentlich bekannt waren oder ohne Verschulden der Empfangenden Partei öffentlich bekannt werden;</Li>
                <Li marker="b)">der Empfangenden Partei nachweislich bereits vor der Offenlegung rechtmäßig und ohne Geheimhaltungspflicht bekannt waren;</Li>
                <Li marker="c)">aufgrund zwingender gesetzlicher Vorschriften oder behördlicher bzw. gerichtlicher Anordnung offengelegt werden müssen; in diesem Fall ist die Offenlegende Partei — soweit rechtlich zulässig — vorab unverzüglich zu informieren.</Li>
                <P>Die Beweislast für das Vorliegen einer Ausnahme trägt die Empfangende Partei.</P>
            </Section>

            <Section num="7" title="Dauer der Verpflichtung">
                <P>
                    Die Geheimhaltungspflicht beginnt mit Unterzeichnung dieser Vereinbarung und besteht auch nach
                    Beendigung des Testbetriebs bzw. der geschäftlichen Beziehung zwischen den Parteien fort,
                    längstens jedoch für einen Zeitraum von <Text style={{ fontWeight: 700, color: C.textPrimary }}>fünf (5) Jahren</Text> ab
                    dem Datum des Gesprächs gemäß § 1. Für Informationen, die als Geschäftsgeheimnis im Sinne des
                    Geschäftsgeheimnisgesetzes (GeschGehG) geschützt sind, gilt die Geheimhaltungspflicht
                    darüber hinaus für die Dauer des gesetzlichen Schutzes fort.
                </P>
            </Section>

            <Section num="8" title="Vertragsstrafe und Schadensersatz">
                <P>
                    (1) Für jeden Fall einer schuldhaften Verletzung der Verpflichtungen aus dieser Vereinbarung
                    verpflichtet sich die Empfangende Partei zur Zahlung einer Vertragsstrafe in Höhe von
                    <Text style={{ fontWeight: 700, color: C.textPrimary }}> 25.000 EUR</Text> an die Offenlegende Partei.
                    Bei einer dauerhaften oder fortgesetzten Zuwiderhandlung gilt jeder angefangene Monat als
                    eigenständiger Verstoß.
                </P>
                <P>
                    (2) Die Geltendmachung eines darüber hinausgehenden Schadens sowie von Unterlassungs- und
                    Beseitigungsansprüchen bleibt ausdrücklich vorbehalten; eine verwirkte Vertragsstrafe wird auf
                    einen etwaigen Schadensersatzanspruch angerechnet.
                </P>
            </Section>

            <Section num="9" title="Schlussbestimmungen">
                <P>
                    (1) Änderungen und Ergänzungen dieser Vereinbarung bedürfen der Textform. Dies gilt auch für die
                    Aufhebung dieses Formerfordernisses.
                </P>
                <P>
                    (2) Sollte eine Bestimmung dieser Vereinbarung unwirksam sein oder werden, bleibt die Wirksamkeit
                    der übrigen Bestimmungen unberührt. Anstelle der unwirksamen Bestimmung gilt eine Regelung als
                    vereinbart, die dem wirtschaftlich Gewollten am nächsten kommt.
                </P>
                <P>
                    (3) Es gilt ausschließlich das Recht der Bundesrepublik Deutschland unter Ausschluss des
                    UN-Kaufrechts. Gerichtsstand ist — soweit gesetzlich zulässig — der Sitz der Offenlegenden Partei.
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
                        <Text style={[s.fillCaption, { fontWeight: 700, color: C.textPrimary }]}>Offenlegende Partei</Text>
                        <Text style={s.fillCaption}>Vela / Agentur OS · Name in Druckbuchstaben</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={[s.fillLine, { height: 34 }]} />
                        <Text style={[s.fillCaption, { fontWeight: 700, color: C.textPrimary }]}>Empfangende Partei</Text>
                        <Text style={s.fillCaption}>Name in Druckbuchstaben · Funktion</Text>
                    </View>
                </View>
            </View>

            <Footer />
        </Page>
    </Document>
);

// ─────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────
const OUTPUT = `${process.cwd()}/Verschwiegenheitserklaerung-Vela.pdf`;

(async () => {
    console.log('Rendering Vela NDA PDF…');
    await renderToFile(<Doc />, OUTPUT);
    console.log(`PDF written: ${OUTPUT}`);
})();
