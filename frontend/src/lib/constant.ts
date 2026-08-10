export const clients = [...new Array(10)].map((client, index) => ({
  href: `/${index + 1}.png`,
}))

export const BASE_URL = process.env.NEXT_PUBLIC_PROD_BASE_URL
  ? `${process.env.NEXT_PUBLIC_PROD_BASE_URL}api`
  : "http://localhost:8000/api";


export const faqs = [
  {
    question: "How much does Pandaprep cost to use?",
    answer: "Pandaprep is free to use with premium features available via subscription.",
  },
  {
    question: "How does Pandaprep work?",
    answer: "Pandaprep uses AI to generate, organize, and manage your notes efficiently.",
  },
  {
    question: "Can I access Pandaprep via API?",
    answer: "API integration will be available soon.",
  },
  {
    question: "How is my data being stored and managed?",
    answer: "Your data is securely stored with encryption and can be managed from your account settings.",
  },
  {
    question: "Is using Pandaprep considered cheating?",
    answer: "No, Pandaprep is a productivity tool designed to enhance learning and efficiency.",
  },
];


export const PLANS = [
  {
    title: "Starter",
    description: "Perfect for those just getting started with our product. Try it out and explore all the features risk-free!",
    price: "₹49",
    cost: 49,
    credits: 15,
    features: [
      "Credits - 15",
      "Access to all features",
      "₹3.33/credit",
      "1 credit per detailed pdf"
    ],
    limitations: [],
  },
  {
    title: "Growth",
    description: "If you've gotten the hang of our notes and want to stock up on cheat sheets for your exams, this is for you!",
    price: "₹249",
    cost: 249,
    credits: 100,
    features: [
      "Credits - 100",
      "Access to all features",
      "₹2.49/credit",
      "1 credit per detailed pdf",
      "25% cheaper per credit than Starter plan"
    ],
    limitations: [],
  },
  {
    title: "Scale",
    description: "Ideal for universities, schools, and institutions that need bulk access to our resources at the best value.",
    price: "Custom",
    cost: 1500,
    credits: 450,
    features: [
      "Get in touch for a custom plan",
      "Credits - Custom",
      "Access to all features",
      "1 credit per detailed pdf",
    ],
    limitations: [
    ],
  },
];
