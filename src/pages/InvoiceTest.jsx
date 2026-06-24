// src/pages/InvoiceTest.jsx
import InvoiceReceipt from "../components/InvoiceReceipt";

const dummyInvoice = {
  invoiceId: "SDS-001",
  date: "24 Jun 2026",
  billingCycle: "monthly",
  transactionId: "pay_PnK3dL9nQrT2",
  paymentMethod: "Razorpay",
  status: "Paid",
  lineItems: [
    { type: "plan",  name: "SkyUp CRM — Growth Plan", sub: "Monthly subscription (1 month)", quantity: 1, amount: 2117.80 },
   
  ],
  activated: ["Growth Plan · Monthly"],
  customer: {
    name: "Acme Corp Pvt Ltd",
    email: "billing@acmecorp.com",
    address: "12, MG Road, Bengaluru - 560001",
    gstin: "29AABCU9603R1ZX",
    stateCode: "29",
  },
};

export default function InvoiceTest() {
  return <InvoiceReceipt invoice={dummyInvoice} onClose={() => window.history.back()} />;
}
