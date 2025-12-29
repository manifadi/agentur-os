import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Project, AgencySettings, Client, Employee } from '../../types';

const styles = StyleSheet.create({
    page: {
        paddingTop: 110, // Space for Fixed Header
        paddingBottom: 80, // Space for Fixed Footer
        paddingHorizontal: 40,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#111827',
        lineHeight: 1.4,
    },
    // FIXED HEADER
    headerFixed: {
        position: 'absolute',
        top: 30,
        left: 40,
        right: 40,
        height: 80,
    },
    headerLogo: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'left', // Keep it left aligned
    },

    // META BLOCK (Not fixed, first page only usually, but user wants structure)
    // We keep address/meta in flow, so it pushes content down.
    metaContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        marginTop: 0,
        alignItems: 'flex-start',
    },
    addressBlock: {
        width: '40%',
        paddingTop: 10,
        fontSize: 10,
    },
    senderLine: {
        fontSize: 6,
        color: '#666',
        marginBottom: 8,
        textDecoration: 'underline',
    },
    metaBlock: {
        width: '55%',
        alignItems: 'flex-end',
    },
    metaRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 2,
    },
    metaLabel: {
        width: 80,
        textAlign: 'right',
        color: '#6B7280',
        fontSize: 8,
        marginRight: 10,
    },
    metaValue: {
        width: 160,
        textAlign: 'right',
        fontSize: 8,
        fontWeight: 'bold',
    },

    // TITLE
    titleBlock: {
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 10,
    },
    mainTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subTitle: {
        fontSize: 12,
        color: '#4B5563',
    },

    // TABLE (Restored "Tabular" Look: Gray Header, Borders)
    table: {
        width: '100%',
        marginBottom: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    tableHeaderRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB', // Restored Gray Background
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 8,
        paddingHorizontal: 4,
        alignItems: 'flex-start',
    },

    // Columns
    colNum: { width: '10%', fontSize: 9, color: '#6B7280' },
    colDesc: { width: '45%', fontSize: 9 },
    colQty: { width: '15%', textAlign: 'right', fontSize: 9 },
    colUnit: { width: '15%', textAlign: 'right', fontSize: 9 },
    colTotal: { width: '15%', textAlign: 'right', fontSize: 9 },

    // TEXT
    textBlock: {
        marginBottom: 20,
        textAlign: 'justify',
        fontSize: 9,
    },

    // TOTALS
    totalBlock: {
        marginTop: 10,
        alignSelf: 'flex-end',
        width: '40%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
        paddingVertical: 2,
    },
    totalLabel: { fontSize: 9 },
    totalLabelBold: { fontSize: 10, fontWeight: 'bold' },
    totalValue: { fontSize: 9, textAlign: 'right' },
    totalValueBold: { fontSize: 10, fontWeight: 'bold', textAlign: 'right' },

    // FIXED FOOTER
    footerFixed: {
        position: 'absolute',
        bottom: 30,
        left: 40,
        right: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerCol: {
        width: '32%',
    },
    footerLine: {
        fontSize: 6,
        color: '#000',
        marginBottom: 2,
    },
    redLine: {
        width: 20,
        height: 2,
        backgroundColor: '#E11D48',
        marginBottom: 8,
    }
});

interface ContractPDFProps {
    project: Project;
    agency: AgencySettings | null;
    client: Client | null;
    intro: string;
    outro: string;
}

export default function ContractPDF({ project, agency, client, intro, outro }: ContractPDFProps) {
    const getRate = (p: any) => p.hourly_rate ?? p.unit_price ?? 0;
    const getAmount = (p: any) => p.hours_sold ?? p.quantity ?? 0;
    const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';

    let totalNet = 0;
    if (project.sections && project.sections.length > 0) {
        totalNet = project.sections.reduce((acc, section) => {
            const sectionTotal = section.positions?.reduce((sum, p) => sum + (getRate(p) * getAmount(p)), 0) || 0;
            return acc + sectionTotal;
        }, 0);
    } else {
        totalNet = project.positions?.reduce((sum, p) => sum + (getRate(p) * getAmount(p)), 0) || 0;
    }
    const tax = totalNet * 0.20;
    const totalGross = totalNet + tax;

    const pm = project.employees;

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* FIXED HEADER: ON EVERY PAGE */}
                <View style={styles.headerFixed} fixed>
                    {agency?.document_header_url ? (
                        <Image src={agency.document_header_url} style={styles.headerLogo} />
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', height: '100%' }}>
                            {agency?.logo_url && <Image src={agency.logo_url} style={{ width: 150, height: 50, objectFit: 'contain' }} />}
                            {!agency?.logo_url && <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{agency?.company_name}</Text>}
                        </View>
                    )}
                </View>

                {/* META INFO (Not Fixed, flows with text) */}
                <View style={styles.metaContainer}>
                    <View style={styles.addressBlock}>

                        <Text style={{ fontSize: 9, marginTop: 4 }}>{client?.company_name || client?.name}</Text>
                        <Text style={{ fontSize: 9 }}>{client?.address}</Text>
                        <Text style={{ fontSize: 9 }}>{project.invoice_contact?.name || client?.full_name || ''}</Text>
                        <Text style={{ fontSize: 9 }}>{client?.uid_number ? `UID: ${client.uid_number}` : ''}</Text>
                    </View>

                    <View style={styles.metaBlock}>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Angebotsnummer</Text>
                            <Text style={styles.metaValue}>{project.job_number}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Projektnummer</Text>
                            <Text style={styles.metaValue}>{project.job_number}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>UID-Nr.</Text>
                            <Text style={styles.metaValue}>{agency?.tax_id}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Datum</Text>
                            <Text style={styles.metaValue}>{new Date().toLocaleDateString('de-DE')}</Text>
                        </View>

                        {pm && (
                            <>
                                <View style={{ height: 6 }} />
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Mitarbeiter</Text>
                                    <Text style={styles.metaValue}>{pm.name}</Text>
                                </View>
                                <View style={styles.metaRow}>
                                    <Text style={styles.metaLabel}>Email</Text>
                                    <Text style={styles.metaValue}>{pm.email}</Text>
                                </View>
                                {pm.phone && (
                                    <View style={styles.metaRow}>
                                        <Text style={styles.metaLabel}>Telefon</Text>
                                        <Text style={styles.metaValue}>{pm.phone}</Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>

                {/* CONTENT */}
                <View style={styles.titleBlock}>
                    <Text style={styles.mainTitle}>Angebot – {project.title}</Text>
                </View>

                {intro && <Text style={styles.textBlock}>{intro}</Text>}

                {/* TABLE (Restored Visuals) */}
                <View style={styles.table}>
                    {/* Header Background */}
                    <View style={styles.tableHeaderRow}>
                        <Text style={styles.colNum}>Pos.</Text>
                        <Text style={styles.colDesc}>Bezeichnung</Text>
                        <Text style={styles.colQty}>Menge</Text>
                        <Text style={styles.colUnit}>Einzel</Text>
                        <Text style={styles.colTotal}>Gesamt</Text>
                    </View>

                    {/* Content */}
                    {(project.sections && project.sections.length > 0) ? project.sections.map((sec, i) => (
                        <View key={sec.id} wrap={false}>
                            {/* Section Title Row (No border bottom to group with items) */}
                            <View style={[styles.tableRow, { backgroundColor: '#F9FAFB', borderBottomWidth: 0, paddingVertical: 4 }]}>
                                <Text style={[styles.colNum, { fontWeight: 'bold' }]}>{i + 1}.0</Text>
                                <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>{sec.title}</Text>
                                <Text style={styles.colQty}></Text>
                                <Text style={styles.colUnit}></Text>
                                <Text style={styles.colTotal}></Text>
                            </View>

                            {/* Positions */}
                            {sec.positions?.map((pos, j) => (
                                <View key={pos.id} style={styles.tableRow}>
                                    <Text style={styles.colNum}>{i + 1}.{j + 1}</Text>
                                    <View style={styles.colDesc}>
                                        <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{pos.title}</Text>
                                        {pos.description && <Text style={{ fontSize: 8, color: '#4B5563' }}>{pos.description}</Text>}
                                    </View>
                                    <Text style={styles.colQty}>{getAmount(pos)} {pos.unit || 'Std.'}</Text>
                                    <Text style={styles.colUnit}>{fmt(getRate(pos)).replace(' EUR', '')}</Text>
                                    <Text style={styles.colTotal}>{fmt(getRate(pos) * getAmount(pos)).replace(' EUR', '')}</Text>
                                </View>
                            ))}
                        </View>
                    )) : (
                        // Flat
                        project.positions?.map((pos, i) => (
                            <View key={pos.id} style={styles.tableRow} wrap={false}>
                                <Text style={styles.colNum}>{i + 1}.0</Text>
                                <View style={styles.colDesc}>
                                    <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{pos.title}</Text>
                                    {pos.description && <Text style={{ fontSize: 8, color: '#4B5563' }}>{pos.description}</Text>}
                                </View>
                                <Text style={styles.colQty}>{getAmount(pos)} {pos.unit || 'Std.'}</Text>
                                <Text style={styles.colUnit}>{fmt(getRate(pos)).replace(' EUR', '')}</Text>
                                <Text style={styles.colTotal}>{fmt(getRate(pos) * getAmount(pos)).replace(' EUR', '')}</Text>
                            </View>
                        ))
                    )}
                </View>

                {/* TOTALS */}
                <View style={styles.totalBlock}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Nettobetrag</Text>
                        <Text style={styles.totalValue}>{fmt(totalNet)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>zzgl. 20% USt.</Text>
                        <Text style={styles.totalValue}>{fmt(tax)}</Text>
                    </View>
                    <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#000', marginTop: 4, paddingTop: 4 }]}>
                        <Text style={styles.totalLabelBold}>Gesamtsumme</Text>
                        <Text style={styles.totalValueBold}>{fmt(totalGross)}</Text>
                    </View>
                </View>

                {outro && <View style={{ marginTop: 20 }}><Text style={styles.textBlock}>{outro}</Text></View>}

                {/* SIGNATURES */}
                <View style={{ marginTop: 40, flexDirection: 'row', gap: 40 }} wrap={false}>
                    <View style={{ flex: 1 }}>
                        <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 4 }} />
                        <Text style={{ fontSize: 7, color: '#666' }}>Ort, Datum, Unterschrift Auftraggeber</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ height: 40, borderBottomWidth: 1, borderBottomColor: '#000', marginBottom: 4 }} />
                        <Text style={{ fontSize: 7, color: '#666' }}>Ort, Datum, Unterschrift Auftragnehmer</Text>
                    </View>
                </View>

                {/* FIXED FOOTER: ON EVERY PAGE */}
                <View style={styles.footerFixed} fixed>
                    <View style={styles.footerCol}>
                        <View style={styles.redLine} />
                        <Text style={[styles.footerLine, { fontWeight: 'bold' }]}>{agency?.company_name}</Text>
                        <Text style={styles.footerLine}>{agency?.general_phone}</Text>
                        <Text style={styles.footerLine}>{agency?.general_email}</Text>
                        <Text style={styles.footerLine}>{agency?.website}</Text>
                    </View>
                    <View style={styles.footerCol}>
                        <View style={{ height: 10 }} />
                        <Text style={styles.footerLine}>{agency?.address}</Text>
                        <Text style={styles.footerLine}>{agency?.footer_text}</Text>
                    </View>
                    <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
                        <View style={{ height: 10 }} />
                        <Text style={styles.footerLine}>UID: {agency?.tax_id}</Text>
                        <Text style={styles.footerLine}>FN: {agency?.commercial_register}</Text>
                        <Text style={styles.footerLine}>Bank: {agency?.bank_name}</Text>
                        <Text style={styles.footerLine}>IBAN: {agency?.iban}</Text>
                        <Text style={styles.footerLine}>BIC: {agency?.bic}</Text>
                    </View>
                </View>
            </Page>
        </Document>
    );
}
