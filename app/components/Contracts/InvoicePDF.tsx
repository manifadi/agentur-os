import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { Project, AgencySettings, Client, ProjectInvoice } from '../../types';

const styles = StyleSheet.create({
    page: {
        paddingTop: 120, // More space for Fixed Header
        paddingBottom: 100, // Fixed Footer buffer
        paddingHorizontal: 50,
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: '#111827',
        lineHeight: 1.4,
    },
    // FIXED HEADER
    headerFixed: {
        position: 'absolute',
        top: 20,
        left: 50,
        right: 50,
        height: 80,
    },
    headerLogo: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'left',
    },

    // META BLOCK
    metaContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
        marginTop: 0,
        alignItems: 'flex-start',
    },
    addressBlock: {
        width: '45%',
        paddingTop: 10,
    },
    senderLine: {
        fontSize: 6,
        color: '#666',
        marginBottom: 4,
        textDecoration: 'underline',
    },
    metaBlock: {
        width: '50%',
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
        width: 140,
        textAlign: 'right',
        fontSize: 8,
        fontWeight: 'bold',
    },

    // TITLE
    titleBlock: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        paddingBottom: 8,
    },
    mainTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subTitle: {
        fontSize: 10,
        color: '#4B5563',
    },

    // TABLE
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
        backgroundColor: '#F9FAFB',
        paddingVertical: 6,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingVertical: 6,
        paddingHorizontal: 4,
        alignItems: 'flex-start',
    },

    // Columns
    colNum: { width: '8%', fontSize: 8, color: '#6B7280' },
    colDesc: { width: '47%', fontSize: 8 },
    colQty: { width: '15%', textAlign: 'right', fontSize: 8 },
    colUnit: { width: '15%', textAlign: 'right', fontSize: 8 },
    colTotal: { width: '15%', textAlign: 'right', fontSize: 8 },

    // TEXT
    textBlock: {
        marginBottom: 15,
        textAlign: 'justify',
        fontSize: 8.5,
        lineHeight: 1.5,
    },

    // TOTALS
    totalBlock: {
        marginTop: 10,
        alignSelf: 'flex-end',
        width: '45%',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 3,
        paddingVertical: 1,
    },
    totalLabel: { fontSize: 8.5 },
    totalLabelBold: { fontSize: 9, fontWeight: 'bold' },
    totalValue: { fontSize: 8.5, textAlign: 'right' },
    totalValueBold: { fontSize: 9, fontWeight: 'bold', textAlign: 'right' },

    // FIXED FOOTER
    footerFixed: {
        position: 'absolute',
        bottom: 25,
        left: 50,
        right: 50,
        borderTopWidth: 0.5,
        borderTopColor: '#E5E7EB',
        paddingTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    footerCol: {
        width: '32%',
    },
    footerLine: {
        fontSize: 6,
        color: '#6B7280',
        marginBottom: 1,
    },
    redLine: {
        width: 15,
        height: 1.5,
        backgroundColor: '#E11D48',
        marginBottom: 4,
    }
});

interface InvoicePDFProps {
    project: Project;
    invoice: Partial<ProjectInvoice>;
    agency: AgencySettings | null;
    client: Client | null;
}

export default function InvoicePDF({ project, invoice, agency, client }: InvoicePDFProps) {
    const fmt = (n: number) => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR';
    const pm = project.employees;

    const renderItems = () => {
        if (invoice.billing_type === 'full') {
            return (
                <View style={styles.tableRow}>
                    <Text style={styles.colNum}>1.0</Text>
                    <Text style={styles.colDesc}>Gesamtabrechnung Projekt: {project.title}</Text>
                    <Text style={styles.colQty}>1</Text>
                    <Text style={styles.colUnit}>{fmt(invoice.total_net || 0).replace(' EUR', '')}</Text>
                    <Text style={styles.colTotal}>{fmt(invoice.total_net || 0).replace(' EUR', '')}</Text>
                </View>
            );
        } else if (invoice.billing_type === 'fraction') {
            return (
                <View style={styles.tableRow}>
                    <Text style={styles.colNum}>1.0</Text>
                    <Text style={styles.colDesc}>Teilabrechnung ({Math.round((invoice.billing_fraction || 1) * 100)}%) Projekt: {project.title}</Text>
                    <Text style={styles.colQty}>1</Text>
                    <Text style={styles.colUnit}>{fmt(invoice.total_net || 0).replace(' EUR', '')}</Text>
                    <Text style={styles.colTotal}>{fmt(invoice.total_net || 0).replace(' EUR', '')}</Text>
                </View>
            );
        } else if (invoice.billing_type === 'positions') {
            const allPositions = project.sections?.flatMap(s => s.positions || []) || project.positions || [];
            return invoice.billed_data?.items?.map((item, i) => {
                const pos = allPositions.find(p => p.id === item.position_id);
                if (!pos) return null;
                return (
                    <View key={i} style={styles.tableRow}>
                        <Text style={styles.colNum}>{i + 1}.0</Text>
                        <View style={styles.colDesc}>
                            <Text style={{ fontWeight: 'bold' }}>{pos.title}</Text>
                            <Text style={{ fontSize: 7, color: '#666' }}>Anteil: {item.percentage}% von {pos.quantity} {pos.unit}</Text>
                        </View>
                        <Text style={styles.colQty}>{item.percentage}%</Text>
                        <Text style={styles.colUnit}>{fmt(pos.unit_price * pos.quantity).replace(' EUR', '')}</Text>
                        <Text style={styles.colTotal}>{fmt(item.amount).replace(' EUR', '')}</Text>
                    </View>
                );
            });
        }
        return null;
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* FIXED HEADER */}
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

                {/* META INFO */}
                <View style={styles.metaContainer}>
                    <View style={styles.addressBlock}>
                        <Text style={{ fontSize: 9, marginTop: 4 }}>{client?.full_name || client?.name}</Text>
                        <Text style={{ fontSize: 9 }}>{client?.address}</Text>
                        {project.invoice_contact?.name && <Text style={{ fontSize: 9 }}>{project.invoice_contact.name}</Text>}
                        <Text style={{ fontSize: 9 }}>{client?.uid_number ? `UID: ${client.uid_number}` : ''}</Text>
                    </View>

                    <View style={styles.metaBlock}>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Rechnungs-Nr.</Text>
                            <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
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
                            <Text style={styles.metaValue}>{new Date(invoice.invoice_date || new Date()).toLocaleDateString('de-DE')}</Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Text style={styles.metaLabel}>Kundennummer</Text>
                            <Text style={styles.metaValue}>{client?.id.slice(0, 8)}</Text>
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
                    <Text style={styles.mainTitle}>Rechnung – {project.title}</Text>
                </View>

                {invoice.intro_text && <Text style={styles.textBlock}>{invoice.intro_text}</Text>}

                {/* TABLE */}
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={styles.colNum}>Pos.</Text>
                        <Text style={styles.colDesc}>Bezeichnung</Text>
                        <Text style={styles.colQty}>Menge / %</Text>
                        <Text style={styles.colUnit}>Gesamtpreis Pos.</Text>
                        <Text style={styles.colTotal}>Betreffende Summe</Text>
                    </View>
                    {renderItems()}
                </View>

                {/* TOTALS */}
                <View style={styles.totalBlock}>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Nettobetrag</Text>
                        <Text style={styles.totalValue}>{fmt(invoice.total_net || 0)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>zzgl. 20% USt.</Text>
                        <Text style={styles.totalValue}>{fmt(invoice.total_tax || 0)}</Text>
                    </View>
                    <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#000', marginTop: 4, paddingTop: 4 }]}>
                        <Text style={styles.totalLabelBold}>Gesamtsumme</Text>
                        <Text style={styles.totalValueBold}>{fmt(invoice.total_gross || 0)}</Text>
                    </View>
                </View>

                {invoice.outro_text && <View style={{ marginTop: 20 }}><Text style={styles.textBlock}>{invoice.outro_text}</Text></View>}

                {/* FIXED FOOTER */}
                <View style={styles.footerFixed} fixed>
                    <View style={styles.footerCol}>
                        <View style={styles.redLine} />
                        <Text style={[styles.footerLine, { fontWeight: 'bold', color: '#111827' }]}>{agency?.company_name}</Text>
                        <Text style={styles.footerLine}>{agency?.general_phone}</Text>
                        <Text style={styles.footerLine}>{agency?.general_email}</Text>
                        <Text style={styles.footerLine}>{agency?.website}</Text>
                    </View>
                    <View style={styles.footerCol}>
                        <Text style={styles.footerLine}>{agency?.address}</Text>
                        <View style={{ marginTop: 2 }}>
                            <Text style={styles.footerLine}>{agency?.footer_text}</Text>
                        </View>
                    </View>
                    <View style={[styles.footerCol, { alignItems: 'flex-end' }]}>
                        <Text style={styles.footerLine}>UID: {agency?.tax_id}</Text>
                        <Text style={styles.footerLine}>FN: {agency?.commercial_register}</Text>
                        <Text style={styles.footerLine}>Bank: {agency?.bank_name}</Text>
                        <Text style={styles.footerLine}>IBAN: {agency?.iban}</Text>
                        <Text style={styles.footerLine}>BIC: {agency?.bic}</Text>
                    </View>
                </View>
            </Page>
        </Document >
    );
}
