// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDGr_T4bPcjOhkAUO2pFI81OQYIqqz6UWs",
  authDomain: "aplikasi-clean-wash-10457.firebaseapp.com",
  projectId: "aplikasi-clean-wash-10457",
  storageBucket: "aplikasi-clean-wash-10457.firebasestorage.app",
  messagingSenderId: "543784330328",
  appId: "1:543784330328:web:57f6bb4d5e12a52ea9562d",
  measurementId: "G-HFEQW4SQJ6"
};

// Inisialisasi Firebase
const app = firebase.initializeApp(firebaseConfig);

// Inisialisasi Database & Auth
const db = firebase.firestore();
const auth = firebase.auth(); // ✅ INI BARU DITAMBAHKAN    