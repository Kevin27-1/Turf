import React, { useState, useEffect } from 'react';
import { auth } from './firebase.js';
import BounceCards from './BounceCards.jsx';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  User, 
  Phone, 
  MapPin, 
  ChevronRight, 
  ArrowLeft, 
  Loader2, 
  AlertTriangle, 
  Sparkles,
  History,
  Trash2,
  Settings,
  HelpCircle,
  XCircle,
  Share2,
  Star,
  MessageSquare,
  Lock,
  Mail,
  X,
  ChevronLeft
} from 'lucide-react';

// Format date to local YYYY-MM-DD string
const toLocalDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Format time from 24h (HH:MM or HH:MM:SS) to 12h (hh:mm AM/PM)
const formatTime12h = (timeStr) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  const hour = parseInt(parts[0], 10);
  const min = parts[1] || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const hourFormatted = String(hour12).padStart(2, '0');
  return `${hourFormatted}:${min} ${ampm}`;
};

// Format date from YYYY-MM-DD to a user-friendly short string (e.g. "Mon, Jul 17")
const formatDateDisplayShort = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short'
  });
};

// Format date from YYYY-MM-DD to a user-friendly long string (e.g. "Monday, July 17, 2026")
const formatDateDisplayLong = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export default function App() {
  const isAdminPath = window.location.pathname === '/admin';
  if (isAdminPath) {
    return <AdminApp />;
  }

  const [currentTab, setCurrentTab] = useState('home'); // 'home', 'book', 'passes', 'profile'
  const [profileSub, setProfileSub] = useState(null); // null, 'edit', 'faq', 'settings', 'help', 'cancel-board', 'invite', 'rate'
  const [publicSettings, setPublicSettings] = useState({
    turf_name: 'Golden Arm Turf',
    sport_types_offered: ['Football', 'Cricket']
  });

  const [reviewsData, setReviewsData] = useState(null);

  useEffect(() => {
    fetch('/api/settings/public')
      .then(res => res.json())
      .then(data => {
        if (data && data.turf_name) {
          setPublicSettings(data);
        }
      })
      .catch(err => console.error('Failed to load public settings:', err));

    fetch('/api/reviews')
      .then(res => res.json())
      .then(data => setReviewsData(data))
      .catch(err => console.error('Failed to load reviews:', err));
  }, []);

  // Custom Phone OTP Auth State
  const [user, setUser] = useState(null); // Contains { id, name, phone }
  const [authLoading, setAuthLoading] = useState(true);
  const [otpStep, setOtpStep] = useState('phone'); // 'phone', 'otp', 'register'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userNameInput, setUserNameInput] = useState('');
  const [authFormLoading, setAuthFormLoading] = useState(false);
  const [authFormError, setAuthFormError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);
  
  // Booking Form State
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  
  // Confirmed details
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [holdData, setHoldData] = useState(null); // { orderId, bookingId, totalAmount, advanceAmount, balanceAmount, heldUntil }
  const [holdTimeLeft, setHoldTimeLeft] = useState(0);

  // Local Storage Bookings & Profile list
  const [myBookings, setMyBookings] = useState([]);
  const [profile, setProfile] = useState({ name: 'Guest Player', email: '', phone: '+91 98765 43210' });

  // Temp profile edit state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  // Support Form State
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSuccess, setSupportSuccess] = useState('');

  // App Settings State
  const [settingsSMS, setSettingsSMS] = useState(true);
  const [settingsWA, setSettingsWA] = useState(true);
  const [settingsLang, setSettingsLang] = useState('english');

  // FAQ Accordion open states
  const [openFaqIdx, setOpenFaqIdx] = useState(null);

  // Clipboard Copied notification state
  const [inviteCopied, setInviteCopied] = useState(false);

  // Rate Us feedback state
  const [ratingVal, setRatingVal] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Cancellation State
  const [cancelingId, setCancelingId] = useState(null);
  const [cancelError, setCancelError] = useState('');
  const [activeCancellation, setActiveCancellation] = useState(null);
  const [cancelSuccessData, setCancelSuccessData] = useState(null);

  // INTERACTIVE HOME STATES
  const [liveTeaserText, setLiveTeaserText] = useState('Checking today\'s schedule...');
  const [liveTeaserSlotId, setLiveTeaserSlotId] = useState(null);
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const galleryImages = [
    { src: '/turf_real_day.jpg', caption: 'Golden Arm Turf Pitch View (Day)' },
    { src: '/turf_real_night.jpg', caption: 'Playing at Night Under Lights' },
    { src: '/turf_grass.jpg', caption: 'FIFA-certified Surface Close-up' },
    { src: '/turf_real_map.png', caption: 'Golden Arm Turf Map Location' }
  ];

  // Restore session from localStorage on Mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('jwt_token');
      const savedUser = localStorage.getItem('user_profile');

      if (token && savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setProfile({
            name: parsedUser.name,
            email: '',
            phone: parsedUser.phone
          });

          // Load user bookings from server
          await fetchBookings();
        } catch (err) {
          console.error("Failed to restore session:", err);
          handleSignOut();
        }
      } else {
        setMyBookings([]);
        setProfile({ name: 'Guest Player', email: '', phone: '' });
      }
      setAuthLoading(false);
    };

    initializeAuth();
  }, []);

  // Generate dates on Mount
  useEffect(() => {
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    setDates(list);
    if (list.length > 0) {
      setSelectedDate(toLocalDateString(list[0]));
    }
  }, []);

  // Fetch slots whenever selectedDate changes and tab is 'book'
  useEffect(() => {
    if (selectedDate && currentTab === 'book') {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, currentTab]);

  // Fetch Today's Live Availability Teaser whenever Home tab is active
  useEffect(() => {
    if (currentTab === 'home') {
      fetchLiveTeaser();
    }
  }, [currentTab]);

  // Scroll-triggered reveal for home page sections
  useEffect(() => {
    if (currentTab !== 'home') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // animate once, then stop watching
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    // Small timeout lets React finish painting the home DOM before we query
    const timer = setTimeout(() => {
      document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
    }, 60);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [currentTab, reviewsData]);

  // Reservation Hold Timer countdown

  useEffect(() => {
    if (!holdData || !holdData.heldUntil) return;
    
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((new Date(holdData.heldUntil).getTime() - Date.now()) / 1000));
      setHoldTimeLeft(diff);
      if (diff === 0) {
        setBookingError('Reservation hold expired! The slot has been released.');
        // Refresh slots automatically
        if (selectedDate && currentTab === 'book') {
          fetchSlots(selectedDate);
        }
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [holdData, selectedDate, currentTab]);

  // Scroll Listener for Sticky Bottom CTA
  useEffect(() => {
    const handleScroll = () => {
      if (currentTab === 'home' && window.scrollY > 380) {
        setShowStickyCTA(true);
      } else {
        setShowStickyCTA(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentTab]);

  // Handle keyboard events in Lightbox modal
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') handleLightboxNext();
      if (e.key === 'ArrowLeft') handleLightboxPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, lightboxIndex]);

  const fetchSlots = async (dateStr) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/slots?date=${dateStr}`);
      if (!res.ok) {
        throw new Error('Failed to load slots');
      }
      const data = await res.json();
      setSlots(data);
    } catch (err) {
      console.error(err);
      setError('Could not connect to server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    const token = localStorage.getItem('jwt_token');
    if (!token) return;
    try {
      const res = await fetch('/api/bookings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);
      } else if (res.status === 401) {
        handleSignOut();
      }
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    }
  };

  const formatDeadlineDisplay = (isoString) => {
    if (!isoString) return '';
    const dateObj = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isToday = dateObj.toDateString() === today.toDateString();
    const isTomorrow = dateObj.toDateString() === tomorrow.toDateString();

    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) {
      return `${timeStr} today`;
    } else if (isTomorrow) {
      return `${timeStr} tomorrow`;
    } else {
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${dateStr} at ${timeStr}`;
    }
  };

  const handleCancelBooking = async (bookingId) => {
    setCancelingId(bookingId);
    setCancelError('');
    try {
      const token = localStorage.getItem('jwt_token');
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel booking');
      }

      setCancelSuccessData({ message: data.message });

      // Re-fetch bookings history and slots list
      await fetchBookings();
      if (selectedDate) {
        await fetchSlots(selectedDate);
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
      setCancelError(err.message || 'Failed to cancel booking.');
    } finally {
      setCancelingId(null);
    }
  };

  const fetchLiveTeaser = async () => {
    try {
      const todayStr = toLocalDateString(new Date());
      const res = await fetch(`/api/slots?date=${todayStr}`);
      if (!res.ok) throw new Error();
      const data = await res.json();

      // Filter slots starting in the future that are available
      const currentHour = new Date().getHours();
      const futureAvailable = data.filter(s => {
        const slotHour = parseInt(s.start_time.split(':')[0], 10);
        return s.status === 'available' && slotHour > currentHour;
      });

      if (futureAvailable.length > 0) {
        const nextSlot = futureAvailable[0];
        setLiveTeaserText(`Next available slot: ${formatTime12h(nextSlot.start_time)} today`);
        setLiveTeaserSlotId(nextSlot.id);
      } else {
        const totalOpenToday = data.filter(s => s.status === 'available').length;
        if (totalOpenToday > 0) {
          setLiveTeaserText(`${totalOpenToday} slots open today`);
          setLiveTeaserSlotId(null);
        } else {
          setLiveTeaserText('Fully Booked Today. Reserve tomorrow!');
          setLiveTeaserSlotId(null);
        }
      }
    } catch (err) {
      console.error('Teaser fetch failed:', err);
      setLiveTeaserText('Book your slot online now!');
      setLiveTeaserSlotId(null);
    }
  };

  const handleQuickSeed = async () => {
    setSeeding(true);
    setError('');
    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error('Seeding failed');
      await res.json();
      if (selectedDate) {
        await fetchSlots(selectedDate);
      }
      fetchLiveTeaser();
    } catch (err) {
      console.error(err);
      setError('Failed to seed slots. Please check backend connection.');
    } finally {
      setSeeding(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleOpenBooking = async (slot) => {
    if (slot.status === 'booked' || slot.status === 'blocked') return;
    if (!user) {
      setError('Please log in from the Profile tab to book a slot.');
      setCurrentTab('profile');
      return;
    }
    setSelectedSlot(slot);
    setBookingLoading(true);
    setBookingError('');
    setHoldData(null);

    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) throw new Error('Please log in to book a slot.');

      const res = await fetch('/api/bookings/hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ slot_id: slot.id })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reserve the slot.');
      }

      setHoldData({
        orderId: data.order_id,
        bookingId: data.booking_id,
        totalAmount: data.total_amount,
        advanceAmount: data.advance_amount,
        balanceAmount: data.balance_amount,
        heldUntil: new Date(data.held_until)
      });
    } catch (err) {
      console.error(err);
      setBookingError(err.message || 'Could not place reservation hold on slot.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCloseBooking = () => {
    setSelectedSlot(null);
    setHoldData(null);
    setBookingError('');
    setBookingLoading(false);
    // Refresh slots board when closing modal so the user gets up to date status
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  };

  const handleBookingSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!holdData) return;

    if (holdTimeLeft <= 0) {
      setBookingError('Your reservation hold has expired. Please close this modal and try again.');
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) throw new Error('Authentication required.');

      // 1. Fetch Razorpay config
      const configRes = await fetch('/api/config/razorpay-key');
      const configData = await configRes.json();
      if (!configRes.ok) throw new Error('Failed to retrieve payment gateway configuration.');

      // 2. Load Razorpay script
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.');
      }

      // 3. Open Razorpay checkout modal
      const options = {
        key: configData.keyId,
        amount: holdData.advanceAmount * 100, // in paise
        currency: 'INR',
        name: publicSettings.turf_name,
        description: 'Advance Payment for Turf Reservation',
        order_id: holdData.orderId,
        handler: async function (response) {
          setBookingLoading(true);
          setBookingError('');
          try {
            // 4. Verify payment with backend
            const verifyRes = await fetch('/api/bookings/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment verification failed.');
            }

            // 5. Update state
            const updatedBookings = [verifyData.booking, ...myBookings];
            setMyBookings(updatedBookings);
            setConfirmedBooking(verifyData.booking);
            setCurrentTab('passes');
            setProfileSub(null);
            
            // Clean up modal states but keep confirmedBooking
            setSelectedSlot(null);
            setHoldData(null);
          } catch (err) {
            console.error(err);
            setBookingError(err.message || 'Signature verification failed.');
          } finally {
            setBookingLoading(false);
          }
        },
        prefill: {
          name: user?.name || '',
          contact: user?.phone || ''
        },
        theme: {
          color: '#22c55e'
        },
        modal: {
          ondismiss: function () {
            setBookingLoading(false);
          }
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();

    } catch (err) {
      console.error(err);
      setBookingError(err.message || 'An error occurred during booking process.');
      setBookingLoading(false);
    }
  };

  // Profile Edit Submission
  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    try {
      if (user) {
        await updateProfile(auth.currentUser, { displayName: editName });
      }
      const updated = { ...profile, name: editName, email: editEmail };
      setProfile(updated);
      setProfileSub(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenProfileEdit = () => {
    setEditName(profile.name);
    setEditEmail(profile.email);
    setProfileSub('edit');
  };

  // Support message submission mock
  const handleSupportSubmit = (e) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSupportSuccess('Support ticket created. We will message you on WhatsApp shortly!');
    setSupportMessage('');
    setTimeout(() => setSupportSuccess(''), 5000);
  };

  // Rate Us submission mock
  const handleRatingSubmit = (e) => {
    e.preventDefault();
    setRatingSubmitted(true);
    setTimeout(() => {
      setRatingSubmitted(false);
      setProfileSub(null);
      setRatingFeedback('');
    }, 3000);
  };

  // Invite clipboard copy mock
  const handleInviteCopy = () => {
    navigator.clipboard.writeText("Hey! Play at Golden Arm Turf. Book slots here: http://localhost:5173/");
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };



  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setAuthFormError('');
    if (!phoneNumber.trim()) {
      setAuthFormError('Phone number is required');
      return;
    }
    setAuthFormLoading(true);
    try {
      // Format with +91 country code if not specified
      const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

      // Initialize recaptcha container and verifier if not already present
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          'size': 'invisible'
        });
      }

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setOtpStep('otp');
      setOtpCode('');
      console.log(`[FIREBASE AUTH] OTP sent to ${fullPhone}`);
    } catch (err) {
      console.error('Firebase sign-in request failed:', err);
      let errMsg = err.message;
      if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'Phone auth is disabled. Enable it in your Firebase console under Authentication > Sign-in method.';
      } else if (err.code === 'auth/invalid-phone-number') {
        errMsg = 'Invalid phone number format. Enter a 10-digit number.';
      }
      setAuthFormError(errMsg);
    } finally {
      setAuthFormLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthFormError('');
    if (!otpCode.trim() || otpCode.length !== 6) {
      setAuthFormError('Please enter a valid 6-digit OTP code');
      return;
    }
    setAuthFormLoading(true);
    try {
      if (!confirmationResult) {
        throw new Error('No active verification session found. Try requesting another code.');
      }

      // 1. Confirm OTP with Firebase
      const result = await confirmationResult.confirm(otpCode);
      const firebaseToken = await result.user.getIdToken();

      // 2. Validate Firebase token on our backend and get/create local JWT session
      const res = await fetch('/api/auth/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: firebaseToken })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to establish verified session');
      }

      if (data.isNewUser) {
        setOtpStep('register');
        setUserNameInput('');
      } else {
        // Sign in user
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('user_profile', JSON.stringify(data.user));
        setUser(data.user);
        setProfile({
          name: data.user.name,
          email: '',
          phone: data.user.phone
        });

        // Load bookings from server
        const bookingsRes = await fetch('/api/bookings', {
          headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setMyBookings(bookingsData);
        }

        setProfileSub(null);
        setOtpStep('phone');
      }
    } catch (err) {
      console.error('Firebase OTP verification failed:', err);
      let errMsg = err.message;
      if (err.code === 'auth/invalid-verification-code') {
        errMsg = 'Invalid verification code. Please check the code and try again.';
      } else if (err.code === 'auth/code-expired') {
        errMsg = 'Verification code has expired. Please request a new OTP.';
      }
      setAuthFormError(errMsg);
    } finally {
      setAuthFormLoading(false);
    }
  };

  const handleRegisterAccount = async (e) => {
    e.preventDefault();
    setAuthFormError('');
    if (!userNameInput.trim()) {
      setAuthFormError('Name is required');
      return;
    }
    setAuthFormLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, name: userNameInput })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete registration');
      }

      // Log them in
      localStorage.setItem('jwt_token', data.token);
      localStorage.setItem('user_profile', JSON.stringify(data.user));
      setUser(data.user);
      setProfile({
        name: data.user.name,
        email: '',
        phone: data.user.phone
      });
      setMyBookings([]); // New user has no bookings

      setProfileSub(null);
      setOtpStep('phone');
    } catch (err) {
      console.error(err);
      setAuthFormError(err.message || 'Registration failed');
    } finally {
      setAuthFormLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_profile');
    setUser(null);
    setMyBookings([]);
    setProfile({ name: 'Guest Player', email: '', phone: '' });
    setProfileSub(null);
    setOtpStep('phone');
    setPhoneNumber('');
    setOtpCode('');
    setConfirmationResult(null);
  };

  // Dynamic Stats Calculations
  const getStats = () => {
    const total = myBookings.length;
    const todayStr = toLocalDateString(new Date());
    const currentHour = new Date().getHours();

    const upcoming = myBookings.filter(b => {
      if (b.slot.date > todayStr) return true;
      if (b.slot.date === todayStr) {
        const slotHour = parseInt(b.slot.start_time.split(':')[0], 10);
        return slotHour > currentHour;
      }
      return false;
    }).length;

    return { total, upcoming };
  };

  // Cutoff eligibility checker (4 hours)
  const isEligibleForCancellation = (booking) => {
    const [year, month, day] = booking.slot.date.split('-').map(Number);
    const [hour, minute] = booking.slot.start_time.split(':').map(Number);
    const slotStartTime = new Date(year, month - 1, day, hour, minute, 0, 0);

    const timeDiffMs = slotStartTime.getTime() - Date.now();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
    return timeDiffHours >= 4;
  };

  const handleLightboxOpen = (idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const handleLightboxNext = () => {
    setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const handleLightboxPrev = () => {
    setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleLiveTeaserClick = () => {
    setCurrentTab('book');
    const todayStr = toLocalDateString(new Date());
    if (selectedDate !== todayStr) {
      setSelectedDate(todayStr);
    }
    setTimeout(() => {
      if (liveTeaserSlotId) {
        const slotElement = document.getElementById(liveTeaserSlotId);
        if (slotElement) {
          slotElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          slotElement.classList.add('ring-2', 'ring-[#22c55e]');
          setTimeout(() => slotElement.classList.remove('ring-2', 'ring-[#22c55e]'), 2000);
        }
      }
    }, 200);
  };

  const todayStr = toLocalDateString(new Date());
  const nowTime = new Date();
  const currentHour = nowTime.getHours();
  const currentMin = nowTime.getMinutes();

  const activeSlots = slots.filter((slot) => {
    if (slot.date === todayStr) {
      const [slotHour, slotMin] = slot.start_time.split(':').map(Number);
      if (slotHour < currentHour) return false;
      if (slotHour === currentHour && slotMin <= currentMin) return false;
    }
    return true;
  });

  const stats = getStats();

  return (
    <div className="min-h-screen w-full bg-[#070707] text-white">
    <div className="relative flex flex-col items-center pb-24 w-full max-w-md mx-auto md:max-w-none md:mx-0 md:pb-0">
      
      {/* HEADER SECTION (EXCEPT ON HOME SCREEN) */}
      {currentTab !== 'home' && !profileSub && (
        <header className="w-full flex items-center justify-between pb-3 px-6 pt-6 mb-2 border-b border-neutral-900">
          <span className="text-xs font-bold uppercase tracking-widest text-[#22c55e] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></span>
            {currentTab === 'book' && 'Slots Selection'}
            {currentTab === 'passes' && 'Voucher List'}
            {currentTab === 'profile' && 'User Dashboard'}
          </span>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
            Golden Arm Turf
          </span>
        </header>
      )}

      {/* --- TAB CONTENT CONTAINER --- */}

      {/* 1. HOME TAB */}
      {currentTab === 'home' && (
        <main className="flex-1 w-full flex flex-col">
          
          {/* A. HERO SECTION */}
          {/* Mobile: 320px tall centered card | Desktop: full-bleed tall split */}
          <section className="relative w-full h-[320px] md:h-[520px] overflow-hidden flex items-center justify-center md:justify-start">
            <div className="absolute inset-0 z-0">
              <img 
                src="/turf_hero.jpg" 
                alt="Golden Arm Turf" 
                className="w-full h-full object-cover animate-fade-scale"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-black/50 to-transparent md:bg-gradient-to-r md:from-black/90 md:via-black/60 md:to-transparent"></div>
            </div>

            {/* Mobile hero content — centered */}
            <div className="relative z-10 text-center px-6 flex flex-col items-center md:hidden">
              <div style={{transitionDelay:'0ms'}} className="scroll-reveal border border-[#22c55e]/60 bg-black/40 text-[#22c55e] px-3 py-0.5 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></span>
                Open 24 Hours
              </div>
              {user && (
                <div style={{transitionDelay:'80ms'}} className="scroll-reveal text-[10px] font-bold text-[#22c55e] uppercase tracking-widest mb-2">
                  Hi, {user.name}
                </div>
              )}
              {(() => {
                const nameParts = publicSettings.turf_name.split(' ');
                const firstName = nameParts[0] || 'Naduparambil';
                const lastName = nameParts.slice(1).join(' ') || 'Turf';
                return (
                  <>
                    <h1 style={{transitionDelay:'80ms'}} className="scroll-reveal text-[2.25rem] font-black tracking-tighter uppercase text-white leading-none">
                      {firstName}
                    </h1>
                    <h1 style={{transitionDelay:'160ms'}} className="scroll-reveal text-[3.5rem] font-black tracking-tighter uppercase text-[#22c55e] leading-none mt-0.5">
                      {lastName}
                    </h1>
                  </>
                );
              })()}
              <p style={{transitionDelay:'260ms'}} className="scroll-reveal text-neutral-300 text-[9px] font-bold uppercase tracking-widest mt-2 max-w-[280px]">
                {publicSettings.turf_name}'s Premier Turf Arena
              </p>
              <button
                onClick={() => setCurrentTab('book')}
                style={{transitionDelay:'380ms'}}
                className="scroll-reveal mt-6 px-8 py-3.5 bg-[#22c55e] text-black font-extrabold text-[11px] uppercase tracking-widest rounded-none border border-black hover:bg-[#1db252] transition shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000]"
              >
                Book Court Now &rarr;
              </button>
            </div>

            {/* Desktop hero content — left-aligned, large */}
            <div className="relative z-10 hidden md:flex flex-col items-start px-16 max-w-3xl">
              <div className="scroll-reveal border border-[#22c55e]/60 bg-black/40 text-[#22c55e] px-4 py-1 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"></span>
                Open 24 Hours • Alakode, Kerala
              </div>
              {user && (
                <div className="scroll-reveal text-xs font-bold text-[#22c55e] uppercase tracking-widest mb-3">
                  Welcome back, {user.name}
                </div>
              )}
              {(() => {
                const nameParts = publicSettings.turf_name.split(' ');
                const firstName = nameParts[0] || 'Naduparambil';
                const lastName = nameParts.slice(1).join(' ') || 'Turf';
                return (
                  <>
                    <h1 className="scroll-reveal text-[5rem] font-black tracking-tighter uppercase text-white leading-none">
                      {firstName}
                    </h1>
                    <h1 style={{transitionDelay:'120ms'}} className="scroll-reveal text-[6.5rem] font-black tracking-tighter uppercase text-[#22c55e] leading-none">
                      {lastName}
                    </h1>
                  </>
                );
              })()}
              <p style={{transitionDelay:'240ms'}} className="scroll-reveal text-neutral-400 text-sm font-bold uppercase tracking-widest mt-4 max-w-md">
                Alakode's Premier 5-a-side Turf — Football & Cricket
              </p>
              <div style={{transitionDelay:'360ms'}} className="scroll-reveal flex items-center gap-4 mt-8">
                <button
                  onClick={() => setCurrentTab('book')}
                  className="px-10 py-4 bg-[#22c55e] text-black font-extrabold text-sm uppercase tracking-widest rounded-none border border-black hover:bg-[#1db252] transition shadow-[4px_4px_0px_#000000] hover:shadow-[2px_2px_0px_#000] active:translate-x-1 active:translate-y-1"
                >
                  Book a Slot &rarr;
                </button>
                <button
                  onClick={() => {
                    document.querySelector('.gallery-anchor')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-10 py-4 border border-neutral-700 text-neutral-300 font-bold text-sm uppercase tracking-widest rounded-none hover:border-white hover:text-white transition"
                >
                  See Gallery
                </button>
              </div>
            </div>
          </section>

          {/* B. LIVE AVAILABILITY TEASER */}
          <section className="scroll-reveal w-full px-6 py-2 bg-neutral-950 border-y border-neutral-900 md:px-16">
            <div className="md:max-w-7xl md:mx-auto">
            <button
              onClick={handleLiveTeaserClick}
              className="w-full flex items-center justify-between py-2 text-left text-xs font-bold hover:opacity-80 transition group"
            >
              <span className="flex items-center gap-2 text-white">
                <Sparkles className="w-4 h-4 text-[#22c55e] animate-bounce" />
                <span>{liveTeaserText}</span>
              </span>
              <span className="text-[10px] text-[#22c55e] uppercase tracking-wider flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Book <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
            </div>
          </section>

          {/* C. WHY BOOK HERE */}
          <section className="scroll-reveal w-full px-6 py-8 md:px-16 md:py-16 border-b border-neutral-900">
            <div className="md:max-w-7xl md:mx-auto">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-5 md:text-xs md:mb-10">
                WHY PLAY WITH US?
              </h3>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
                {[
                  { icon: '💡', title: 'Floodlit turf', desc: 'Vibrant high-mast lights for night games' },
                  { icon: '🌿', title: 'FIFA quality grass', desc: 'Resurfaced shock-absorbent synthetic surface' },
                  { icon: '🚿', title: 'Premium amenities', desc: 'Changing rooms, showers, and on-site parking' },
                  { icon: '⚡', title: 'Instant booking', desc: 'Book slots securely online in seconds' }
                ].map((card, i) => (
                  <div
                    key={i}
                    className="border border-neutral-900 bg-neutral-950/40 p-4 md:p-6 hover:border-neutral-700 hover:bg-neutral-900/30 transition active:scale-98"
                  >
                    <span className="text-2xl md:text-4xl block mb-2 md:mb-4">{card.icon}</span>
                    <h4 className="text-xs md:text-sm font-black text-white uppercase tracking-tight mb-1 md:mb-2">{card.title}</h4>
                    <p className="text-[9px] md:text-xs text-neutral-500 leading-normal font-medium">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* D. PHOTO GALLERY SECTION */}
          <section className="scroll-reveal gallery-anchor w-full py-8 border-t border-neutral-900 md:py-16 md:border-t-0">
            <div className="md:max-w-7xl md:mx-auto md:px-16">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 px-6 md:px-0 md:text-xs md:mb-8">
                COURT GALLERY
              </h3>
              {/* Mobile: horizontal scroll */}
              <div className="flex md:hidden gap-3 overflow-x-auto px-6 pb-4 no-scrollbar snap-x snap-mandatory scroll-smooth">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLightboxOpen(idx)}
                    className="flex-shrink-0 w-[180px] h-[120px] border border-neutral-900 bg-neutral-950 relative overflow-hidden snap-center hover:border-[#22c55e]/50 transition"
                  >
                    <img src={img.src} alt={img.caption} className="w-full h-full object-cover hover:scale-105 transition duration-300" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/80 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-neutral-400 text-left truncate">{img.caption}</div>
                  </button>
                ))}
              </div>
              {/* Desktop: grid */}
              <div className="hidden md:grid grid-cols-3 gap-4">
                {galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleLightboxOpen(idx)}
                    className="w-full h-[220px] border border-neutral-900 bg-neutral-950 relative overflow-hidden hover:border-[#22c55e]/50 transition group"
                  >
                    <img src={img.src} alt={img.caption} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                    <div className="absolute bottom-0 inset-x-0 bg-black/80 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-neutral-400 text-left truncate">{img.caption}</div>
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-neutral-600 text-center uppercase tracking-widest font-bold mt-4 md:hidden">Swipe to explore • Tap to expand</p>
              <p className="hidden md:block text-[9px] text-neutral-600 text-center uppercase tracking-widest font-bold mt-4">Click any photo to expand</p>
            </div>
          </section>

          {/* REVIEWS & TESTIMONIALS SECTION */}
          {reviewsData && reviewsData.reviews && Array.isArray(reviewsData.reviews) && reviewsData.reviews.length > 0 && (
            <section className="scroll-reveal w-full py-8 border-t border-neutral-900 md:py-16">
              <div className="md:max-w-7xl md:mx-auto md:px-16 text-center">
                <div className="flex justify-between items-end mb-8 px-6 md:px-0">
                  <div className="text-left">
                    <h3 className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">
                      Google Maps Reviews
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xl md:text-2xl font-black text-white">{reviewsData.rating || 5}</span>
                      <span className="text-[#22c55e] text-sm md:text-base font-black">★★★★★</span>
                      <span className="text-[9px] md:text-xs text-neutral-500 font-bold uppercase">
                        ({reviewsData.total_ratings || 0} Reviews)
                      </span>
                    </div>
                  </div>
                  <a
                    href="https://maps.google.com/?q=Golden+Arm+Turf+Alakode"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 border border-neutral-800 text-neutral-400 hover:border-[#22c55e] hover:text-[#22c55e] font-bold text-[9px] uppercase tracking-wider transition"
                  >
                    Write a Review
                  </a>
                </div>

                {/* Animated BounceCards stack */}
                <div className="w-full flex justify-center py-6 overflow-hidden min-h-[260px]">
                  <BounceCards
                    cards={reviewsData.reviews.slice(0, 5).map((r, idx) => (
                      <div key={idx} className="w-full h-full flex flex-col justify-between p-4 text-left select-none">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-white uppercase truncate max-w-[125px]">
                              {r.author_name}
                            </span>
                            <span className="text-[#22c55e] text-[8px]">
                              {"★".repeat(Math.round(r.rating || 5))}
                            </span>
                          </div>
                          <p className="text-[9.5px] text-neutral-400 font-medium leading-relaxed line-clamp-4">
                            "{r.text}"
                          </p>
                        </div>
                        <span className="text-[8px] text-neutral-600 font-bold uppercase block mt-1">
                          {r.relative_time_description}
                        </span>
                      </div>
                    ))}
                    containerWidth={320}
                    containerHeight={220}
                    animationDelay={0.2}
                    animationStagger={0.06}
                    enableHover={true}
                  />
                </div>
                <p className="text-[8px] text-neutral-600 uppercase tracking-widest font-bold mt-2">
                  Hover or tap reviews to inspect details
                </p>
              </div>
            </section>
          )}

          {/* E+F. PRICING & LOCATION — stacked on mobile, side-by-side on desktop */}
          <section className="scroll-reveal w-full border-t border-neutral-900 md:py-16">
            <div className="md:max-w-7xl md:mx-auto md:px-16 md:grid md:grid-cols-2 md:gap-8">

              {/* Pricing card */}
              <div className="px-6 py-6 md:px-0 md:py-0 bg-neutral-950/30 md:bg-transparent border-b border-neutral-900 md:border-0">
                <h4 className="text-[9px] md:text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
                  GLANCE RATE &amp; INFO
                </h4>
                <div className="border border-neutral-900 bg-neutral-950 p-4 md:p-8">
                  <div className="grid grid-cols-3 gap-2 text-center divide-x divide-neutral-900">
                    <div>
                      <span className="text-[8px] md:text-[10px] text-neutral-500 block uppercase font-bold">Rates</span>
                      <span className="text-xs md:text-xl font-black text-white mt-1 block">₹900 - 1200</span>
                    </div>
                    <div>
                      <span className="text-[8px] md:text-[10px] text-neutral-500 block uppercase font-bold">Hours</span>
                      <span className="text-xs md:text-xl font-black text-white mt-1 block">24 Hours</span>
                    </div>
                    <div>
                      <span className="text-[8px] md:text-[10px] text-neutral-500 block uppercase font-bold">Sports</span>
                      <span className="text-xs md:text-xl font-black text-white mt-1 block">Football / Cricket</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location card */}
              <div className="px-6 py-8 md:px-0 md:py-0">
                <h3 className="text-[10px] md:text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
                  COURT LOCATION
                </h3>
                <div className="border border-neutral-900 bg-neutral-950 p-4 md:p-6">
                  <div className="w-full h-[150px] md:h-[200px] border border-neutral-900 mb-4 bg-[#070707] overflow-hidden">
                    <iframe
                      title="Golden Arm Turf Location Map"
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src="https://maps.google.com/maps?q=Golden+Arm+Turf+Alakode&t=&z=15&ie=UTF8&iwloc=&output=embed"
                    ></iframe>
                  </div>
                  <span className="text-[8px] uppercase font-bold text-neutral-500 block">Address</span>
                  <p className="text-[10px] md:text-xs font-bold text-white mt-0.5 leading-relaxed">
                    Golden Arm Turf, Alakode, Kerala 670571
                  </p>
                  <a
                    href="https://maps.google.com/?q=Golden+Arm+Turf+Alakode"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 w-full py-3 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/5 font-extrabold text-[10px] uppercase tracking-wider rounded-none transition flex items-center justify-center gap-1.5"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Get Directions on Map
                  </a>
                </div>
              </div>

            </div>
          </section>

          {/* G. SCROLL-TRIGGERED STICKY BOTTOM CTA */}
          {showStickyCTA && (
            <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto p-4 z-40 bg-neutral-950 border border-neutral-900 flex justify-between items-center animate-slide-up-sticky shadow-[0_-5px_20px_rgba(0,0,0,0.8)]">
              <div>
                <span className="text-[9px] uppercase font-bold text-[#22c55e] block tracking-wider">Golden Arm Turf</span>
                <span className="text-[10px] font-black text-white block uppercase mt-0.5">Court Open • book now</span>
              </div>
              <button
                onClick={() => {
                  setCurrentTab('book');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2.5 bg-[#22c55e] text-black font-extrabold text-[10px] uppercase tracking-wider rounded-none"
              >
                Reserve Slot &rarr;
              </button>
            </div>
          )}

        </main>
      )}

      {/* 2. BOOK TAB */}
      {currentTab === 'book' && (
        <main className="flex-1 w-full flex flex-col px-6">
          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-2 px-1">
              Select Booking Date
            </label>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
              {dates.map((dateObj, idx) => {
                const dateStr = toLocalDateString(dateObj);
                const isSelected = selectedDate === dateStr;
                const isToday = idx === 0;
                
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = dateObj.getDate();

                return (
                  <button
                    key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-none border transition duration-200 ${
                      isSelected
                        ? 'bg-[#22c55e] border-black text-black font-extrabold shadow-[2px_2px_0px_rgba(255,255,255,0.08)]'
                        : 'bg-neutral-950 border-neutral-900 text-neutral-400 hover:border-neutral-800'
                    }`}
                  >
                    <span className="text-[9px] uppercase font-bold tracking-tighter opacity-80">
                      {isToday ? 'Today' : dayName}
                    </span>
                    <span className="text-base font-black tracking-tight leading-none mt-1">
                      {dayNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-center mb-4 px-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Hourly Blocks
              </label>
              {activeSlots.length > 0 && (
                <span className="text-[10px] text-[#22c55e] font-bold uppercase tracking-widest">
                  {activeSlots.filter(s => s.status === 'available').length} Left
                </span>
              )}
            </div>

            {error && (
              <div className="border border-red-955 bg-red-955/20 p-5 rounded-none text-center mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                <p className="text-xs text-neutral-300 font-bold mb-4">{error}</p>
                <button 
                  onClick={() => fetchSlots(selectedDate)}
                  className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 text-xs font-bold transition"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {!loading && !error && activeSlots.length === 0 && (
              <div className="border border-neutral-900 bg-neutral-955/40 p-6 rounded-none text-center mb-6 flex flex-col items-center">
                <Calendar className="w-10 h-10 text-neutral-700 mb-2" />
                <p className="text-xs font-bold text-white mb-1 uppercase tracking-wider">No Slots Available</p>
                <p className="text-[10px] text-neutral-500 mb-5 max-w-[220px]">
                  Hourly slots have not been generated for {formatDateDisplayShort(selectedDate)}.
                </p>
                <button
                  onClick={handleQuickSeed}
                  disabled={seeding}
                  className="w-full py-3 border border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e]/10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
                >
                  {seeding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Slots...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" /> Auto-Seed 24 Hours
                    </>
                  )}
                </button>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[#22c55e] animate-spin mb-2" />
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Querying court schedule...</p>
              </div>
            )}

            {!loading && !error && activeSlots.length > 0 && (
              <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1 no-scrollbar pb-6">
                {activeSlots.map((slot) => {
                  const isBooked = slot.status === 'booked' || slot.status === 'blocked';
                  const isHeldByOthers = slot.status === 'held' && slot.held_by_user_id !== user?.id;
                  const isHeldByMe = slot.status === 'held' && slot.held_by_user_id === user?.id;
                  const isDisabled = isBooked || isHeldByOthers;

                  return (
                    <button
                      id={slot.id}
                      key={slot.id}
                      onClick={() => handleOpenBooking(slot)}
                      disabled={isDisabled}
                      className={`p-3 border flex flex-col text-left transition relative rounded-none ${
                        isDisabled
                          ? 'bg-neutral-950 border-neutral-900 text-neutral-600 cursor-not-allowed select-none'
                          : isHeldByMe
                            ? 'bg-neutral-900/60 border-[#22c55e] hover:border-[#22c55e] active:scale-[0.97]'
                            : 'bg-neutral-900/40 border-neutral-800 hover:border-[#22c55e] active:scale-[0.97] hover:bg-[#22c55e]/[0.02]'
                      }`}
                    >
                      <span className={`text-[9px] font-bold px-2 py-0.5 self-start mb-3 border ${
                        isDisabled 
                          ? 'bg-neutral-950 border-neutral-900 text-neutral-700' 
                          : 'bg-neutral-900 border-[#22c55e]/20 text-[#22c55e]'
                      }`}>
                        ₹{slot.price}
                      </span>
                      
                      <span className={`text-base font-black leading-none ${
                        isDisabled ? 'text-neutral-600' : 'text-white'
                      }`}>
                        {formatTime12h(slot.start_time)}
                      </span>
                      <span className={`text-[10px] font-bold mt-1 ${
                        isDisabled ? 'text-neutral-700' : 'text-neutral-400'
                      }`}>
                        to {formatTime12h(slot.end_time)}
                      </span>

                      {isBooked && (
                        <span className="absolute top-3 right-3 text-[9px] uppercase font-bold tracking-wider text-neutral-600">
                          Booked
                        </span>
                      )}
                      {isHeldByOthers && (
                        <span className="absolute top-3 right-3 text-[9px] uppercase font-bold tracking-wider text-neutral-600">
                          Held
                        </span>
                      )}
                      {isHeldByMe && (
                        <span className="absolute top-3 right-3 text-[9px] uppercase font-bold tracking-wider text-[#22c55e] animate-pulse">
                          Your Hold
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* 3. PASSES TAB */}
      {currentTab === 'passes' && (
        <main className="flex-1 w-full flex flex-col px-6">
          {!user ? (
            <div className="border border-neutral-900 bg-neutral-950/20 p-8 text-center mt-4">
              <Lock className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
              <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">Authentication Required</p>
              <p className="text-[10px] text-neutral-500 max-w-[200px] mx-auto mb-6">
                Please log in from the Profile tab to view your booked passes.
              </p>
              <button
                onClick={() => setCurrentTab('profile')}
                className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none"
              >
                Go to Profile
              </button>
            </div>
          ) : confirmedBooking ? (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/30 mb-4">
                  <CheckCircle className="w-7 h-7 text-[#22c55e]" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase mb-1">
                  Confirmed!
                </h2>
                <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-wider mb-5">
                  Slot details and reference receipt
                </p>

                <div className="w-full relative bg-neutral-950 border border-[#22c55e]/30 p-5 text-left mb-6 shadow-xl">
                  <div className="border-b border-dashed border-neutral-800 pb-4 mb-4">
                    <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-widest">
                      Golden Arm Turf
                    </span>
                    <h3 className="text-base font-black text-white mt-1 uppercase">
                      Court booking voucher
                    </h3>
                    <span className="text-[9px] text-neutral-600 block mt-1 font-mono uppercase">
                      REF: {confirmedBooking.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Date</span>
                      <span className="font-bold text-white mt-0.5 block">
                        {formatDateDisplayLong(confirmedBooking.slot.date)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Time Duration</span>
                      <span className="font-bold text-[#22c55e] mt-0.5 block">
                        {formatTime12h(confirmedBooking.slot.start_time)} - {formatTime12h(confirmedBooking.slot.end_time)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Customer</span>
                        <span className="font-bold text-white mt-0.5 block truncate">
                          {confirmedBooking.customer_name}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Total Court Price</span>
                        <span className="font-bold text-white mt-0.5 block">
                          ₹{confirmedBooking.total_amount || confirmedBooking.slot.price}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1.5">
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Paid (Online Advance)</span>
                        <span className="font-bold text-[#22c55e] mt-0.5 block">
                          ₹{confirmedBooking.advance_paid_amount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Due at Venue</span>
                        <span className="font-bold text-amber-500 mt-0.5 block">
                          ₹{confirmedBooking.balance_amount}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-[#22c55e]/5 border border-[#22c55e]/15 text-[10px] text-neutral-400 font-bold uppercase tracking-wide">
                      Please pay the remaining ₹{confirmedBooking.balance_amount} at the venue
                    </div>

                    <div className="pt-2.5 border-t border-neutral-900">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-neutral-500 block">Phone</span>
                      <span className="font-bold text-neutral-400 mt-0.5 block">
                        {confirmedBooking.customer_phone}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setConfirmedBooking(null)}
                className="w-full py-4.5 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none"
              >
                Close Receipt
              </button>
            </div>
          ) : (
            <div className="flex-grow flex flex-col">
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 px-1">
                Your Booked Passes
              </h3>

              {myBookings.length === 0 ? (
                <div className="border border-neutral-900 bg-neutral-950/20 p-8 text-center mt-4">
                  <History className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                  <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">No Passes Found</p>
                  <p className="text-[10px] text-neutral-500 max-w-[200px] mx-auto mb-6">
                    You haven't booked any slots yet.
                  </p>
                  <button
                    onClick={() => setCurrentTab('book')}
                    className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none"
                  >
                    Go to Slots Board
                  </button>
                </div>
              ) : (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1 pb-6">
                  {myBookings.map((b) => {
                    const isCancelled = b.booking_status === 'cancelled';
                    
                    // Check if upcoming
                    const [year, month, day] = b.slot.date.split('-').map(Number);
                    const [hour, minute] = b.slot.start_time.split(':').map(Number);
                    const slotStartTime = new Date(year, month - 1, day, hour, minute, 0, 0);
                    const isUpcoming = slotStartTime > new Date();

                    const isPastDeadline = b.cancellation_deadline ? new Date(b.cancellation_deadline) <= new Date() : true;
                    
                    return (
                      <div 
                        key={b.id} 
                        className={`border bg-neutral-950/40 p-4 hover:border-neutral-700 cursor-pointer transition relative ${
                          isCancelled ? 'border-neutral-955 bg-neutral-955/20 opacity-55' : 'border-neutral-900'
                        }`}
                        onClick={() => setConfirmedBooking(b)}
                      >
                        {isCancelled ? (
                          <span className="absolute top-4 right-4 text-[9px] uppercase font-bold text-red-500 tracking-wider">
                            Cancelled
                          </span>
                        ) : (
                          <span className="absolute top-4 right-4 text-[9px] uppercase font-bold text-neutral-600 tracking-wider">
                            Tap to View
                          </span>
                        )}

                        <div className="text-[9px] font-mono text-neutral-600 uppercase mb-2">
                          ID: {b.id.substring(0, 8).toUpperCase()}
                        </div>

                        <div className="text-sm font-black text-white uppercase">
                          {formatTime12h(b.slot.start_time)} - {formatTime12h(b.slot.end_time)}
                        </div>

                        <div className="text-xs font-bold text-[#22c55e] mt-1">
                          {formatDateDisplayShort(b.slot.date)}
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-900/60 text-[10px] text-neutral-400">
                          <div>
                            <span className="block text-neutral-600 font-bold uppercase text-[8px] tracking-wider">Player</span>
                            <span className="font-bold text-neutral-300 truncate block">{b.customer_name}</span>
                          </div>
                          <div>
                            <span className="block text-neutral-600 font-bold uppercase text-[8px] tracking-wider">Paid</span>
                            <span className="text-[#22c55e] font-bold block">₹{b.advance_paid_amount}</span>
                          </div>
                          <div>
                            <span className="block text-neutral-600 font-bold uppercase text-[8px] tracking-wider">At Venue</span>
                            <span className="font-bold text-amber-500 block">₹{b.balance_amount}</span>
                          </div>
                        </div>

                        {/* Cancellation Display & Button */}
                        {isCancelled && b.refund_status && (
                          <div className="mt-3 pt-3 border-t border-dashed border-neutral-900 text-[10px] uppercase font-bold tracking-wider">
                            {b.refund_status === 'processed' && (
                              <span className="text-[#22c55e]">Refund processed (₹{b.refund_amount})</span>
                            )}
                            {b.refund_status === 'pending' && (
                              <span className="text-amber-500">Refund pending (₹{b.refund_amount})</span>
                            )}
                            {b.refund_status === 'not_applicable' && (
                              <span className="text-neutral-500">No refund applies</span>
                            )}
                          </div>
                        )}

                        {!isCancelled && isUpcoming && (
                          <div className="mt-3 pt-3 border-t border-dashed border-neutral-900 flex flex-col gap-2">
                            <div className="text-[9px] uppercase font-bold tracking-wider">
                              {!isPastDeadline ? (
                                <span className="text-[#22c55e]">
                                  Free cancellation until {formatDeadlineDisplay(b.cancellation_deadline)}
                                </span>
                              ) : (
                                <span className="text-red-500/80">
                                  Cancellation window has passed (No Refund)
                                </span>
                              )}
                            </div>
                            <button
                              disabled={cancelingId === b.id}
                              onClick={(e) => { e.stopPropagation(); setActiveCancellation(b); }}
                              className={`w-full py-2.5 font-extrabold text-[9px] uppercase tracking-wider transition ${
                                cancelingId === b.id
                                  ? 'bg-neutral-800 text-neutral-500 cursor-wait'
                                  : 'border border-red-500/30 text-red-500 hover:bg-red-500/5 hover:border-red-500'
                              }`}
                            >
                              Cancel Booking
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {currentTab === 'profile' && (
        <main className="flex-1 w-full flex flex-col px-6">
          {authLoading ? (
            <div className="flex-grow flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
            </div>
          ) : !user ? (
            <div className="border border-neutral-900 bg-neutral-950/50 p-6 space-y-6 my-4 animate-in fade-in duration-200">
              <div id="recaptcha-container"></div>
              <div className="text-center">
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  {otpStep === 'phone' && 'Phone Login'}
                  {otpStep === 'otp' && 'Verify Code'}
                  {otpStep === 'register' && 'New Player Info'}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-1 uppercase font-bold tracking-wider">
                  {otpStep === 'phone' && 'Enter your phone number to sign in'}
                  {otpStep === 'otp' && `Enter 6-digit OTP sent to +91 ${phoneNumber}`}
                  {otpStep === 'register' && 'Complete registration to continue'}
                </p>
              </div>

              {authFormError && (
                <div className="border border-red-900/60 bg-red-950/20 p-3 text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{authFormError}</span>
                </div>
              )}

              {otpStep === 'phone' && (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-500 text-xs font-bold">+91</span>
                      <input 
                        type="tel" 
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210" 
                        maxLength={10}
                        className="w-full bg-neutral-900 border border-neutral-800 text-white font-bold p-3 pl-10 text-xs focus:border-[#22c55e] focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={authFormLoading}
                    className="w-full bg-[#22c55e] text-black font-black uppercase text-xs p-4 flex items-center justify-center gap-2 hover:bg-[#1db252] disabled:bg-neutral-850 disabled:text-neutral-500 transition cursor-pointer"
                  >
                    {authFormLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending OTP...
                      </>
                    ) : (
                      'Send OTP Code'
                    )}
                  </button>
                  <p className="text-center text-[9px] text-neutral-500 uppercase font-bold tracking-wider mt-2">
                    For local mock testing, enter any phone number and use code 123456
                  </p>
                </form>
              )}

              {otpStep === 'otp' && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider">6-Digit Verification Code</label>
                    <input 
                      type="text" 
                      required
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456" 
                      maxLength={6}
                      className="w-full bg-neutral-900 border border-neutral-800 text-white font-bold p-3 text-xs tracking-[0.75em] text-center focus:border-[#22c55e] focus:outline-none transition"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={authFormLoading}
                    className="w-full bg-[#22c55e] text-black font-black uppercase text-xs p-4 flex items-center justify-center gap-2 hover:bg-[#1db252] disabled:bg-neutral-850 disabled:text-neutral-500 transition cursor-pointer"
                  >
                    {authFormLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </button>

                  <div className="text-center pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setOtpStep('phone');
                        setAuthFormError('');
                      }}
                      className="text-xs text-neutral-400 hover:text-white underline"
                    >
                      Change Phone Number
                    </button>
                  </div>
                </form>
              )}

              {otpStep === 'register' && (
                <form onSubmit={handleRegisterAccount} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Your Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value)}
                      placeholder="e.g. John Doe" 
                      className="w-full bg-neutral-900 border border-neutral-800 text-white font-bold p-3 text-xs focus:border-[#22c55e] focus:outline-none transition"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={authFormLoading}
                    className="w-full bg-[#22c55e] text-black font-black uppercase text-xs p-4 flex items-center justify-center gap-2 hover:bg-[#1db252] disabled:bg-neutral-850 disabled:text-neutral-500 transition cursor-pointer"
                  >
                    {authFormLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Completing Signup...
                      </>
                    ) : (
                      'Complete Registration'
                    )}
                  </button>
                </form>
              )}

              <div className="pt-4 border-t border-neutral-900/60 flex justify-center">
                <button 
                  onClick={() => window.open('/admin', '_blank')}
                  className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-[#22c55e] transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Access Admin Desk
                </button>
              </div>
            </div>
          ) : profileSub === null ? (
            <div className="space-y-6">
              
              {/* Profile Card Header */}
              <div className="border border-neutral-900 bg-neutral-950/50 p-4 relative flex items-center gap-4">
                <button
                  onClick={handleOpenProfileEdit}
                  className="absolute top-4 right-4 p-1 text-[#22c55e] hover:text-[#1db252] transition"
                  title="Edit Profile Name/Email"
                >
                  <Settings className="w-4.5 h-4.5" />
                </button>

                <div className="w-14 h-14 rounded-full bg-neutral-900 border border-[#22c55e]/30 flex items-center justify-center text-xl font-black text-[#22c55e]">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : 'G'}
                </div>

                <div className="flex-1 min-w-0 pr-6">
                  <h3 className="text-base font-black text-white truncate uppercase tracking-tight">
                    {profile.name}
                  </h3>
                  {profile.phone && (
                    <p className="text-[10px] text-neutral-400 font-semibold mt-0.5 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-[#22c55e]" />
                      {profile.phone}
                    </p>
                  )}
                  {profile.email && (
                    <p className="text-[10px] text-neutral-400 font-semibold mt-0.5 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-[#22c55e]" />
                      {profile.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-neutral-900 bg-neutral-950/40 p-4 text-left">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Bookings</span>
                  <span className="block text-2xl font-black text-white mt-1">{stats.total}</span>
                </div>
                <div className="border border-neutral-900 bg-neutral-950/40 p-4 text-left">
                  <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Upcoming</span>
                  <span className="block text-2xl font-black text-[#22c55e] mt-1">{stats.upcoming}</span>
                </div>
              </div>

              {/* Menu List - Section 1 */}
              <div>
                <h4 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2 px-1">Bookings Board</h4>
                <div className="border border-neutral-900 bg-neutral-950/20 divide-y divide-neutral-900/60">
                  <button 
                    onClick={() => setCurrentTab('passes')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-[#22c55e]" />
                      My Bookings List
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button 
                    onClick={() => setProfileSub('cancel-board')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500" />
                      Cancellation & Refund
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                </div>
              </div>

              {/* Menu List - Section 2 */}
              <div>
                <h4 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2 px-1">Support & Settings</h4>
                <div className="border border-neutral-900 bg-neutral-950/20 divide-y divide-neutral-900/60">
                  <button 
                    onClick={() => setProfileSub('settings')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#22c55e]" />
                      Preferences & Language
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button 
                    onClick={() => setProfileSub('help')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#22c55e]" />
                      Help & Support Desk
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button 
                    onClick={() => setProfileSub('faq')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#22c55e]" />
                      FAQ & Policies
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button 
                    onClick={() => window.open('/admin', '_blank')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition cursor-pointer"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-neutral-500" />
                      Admin Control Desk
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                </div>
              </div>

              {/* Menu List - Section 3 */}
              <div>
                <h4 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2 px-1">Incentives</h4>
                <div className="border border-neutral-900 bg-neutral-950/20 divide-y divide-neutral-900/60">
                  <button 
                    onClick={() => setProfileSub('invite')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-[#22c55e]" />
                      Invite a Friend
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                  <button 
                    onClick={() => setProfileSub('rate')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-neutral-950/60 transition"
                  >
                    <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#22c55e]" />
                      Rate Our Application
                    </span>
                    <ChevronRight className="w-4 h-4 text-neutral-600" />
                  </button>
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="pt-2">
                <button 
                  onClick={handleSignOut}
                  className="w-full border border-red-950 bg-red-950/25 hover:bg-red-950/40 text-red-400 font-bold text-xs p-4 flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-red-500" />
                  Sign Out of Account
                </button>
              </div>

            </div>
          ) : null}

          {/* B. PROFILE EDIT PAGE */}
          {profileSub === 'edit' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-5">Edit Profile</h3>

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5">
                    Player Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-600">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[#070707] border border-neutral-900 rounded-none py-3 pl-10 pr-4 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1.5">
                    Email Address <span className="text-[8px] text-neutral-600 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-600">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#070707] border border-neutral-900 rounded-none py-3 pl-10 pr-4 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e] transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-neutral-600">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      disabled
                      value={profile.phone}
                      className="w-full bg-neutral-950 border border-neutral-900 rounded-none py-3 pl-10 pr-4 text-xs text-neutral-500 cursor-not-allowed select-none"
                    />
                  </div>
                  <span className="text-[8px] text-neutral-600 block mt-1">Phone number is locked (linked to OTP login profile).</span>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setProfileSub(null)}
                    className="flex-1 py-3 border border-neutral-900 text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-wider rounded-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition"
                  >
                    Save Edits
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* C. FAQ SUB-SCREEN */}
          {profileSub === 'faq' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-4">Frequently Asked Questions</h3>

              <div className="space-y-3">
                {[
                  {
                    q: "What is the cancellation policy?",
                    a: "Bookings can be canceled up to 4 hours before the slot start time. Canceled bookings are fully refunded and the slot is immediately opened for others to reserve."
                  },
                  {
                    q: "How do I reschedule a slot?",
                    a: "Currently, rescheduling is done by canceling your current slot (at least 4 hours in advance) and placing a booking for a new time block."
                  },
                  {
                    q: "What payment methods do you accept?",
                    a: "We accept all major UPI applications (GPay, PhonePe, Paytm), net banking, and direct debit/credit cards at the turf counter."
                  },
                  {
                    q: "Is the turf open during rain?",
                    a: "Yes! Our high-grade artificial turf has an advanced drainage system and remains fully open and playable during light and moderate rainfall."
                  }
                ].map((item, idx) => {
                  const isOpen = openFaqIdx === idx;
                  return (
                    <div key={idx} className="border border-neutral-900 bg-neutral-950/20">
                      <button
                        onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                        className="w-full p-4 flex justify-between items-center text-left text-xs font-bold text-neutral-300 hover:text-white transition"
                      >
                        <span>{item.q}</span>
                        <ChevronRight className={`w-4 h-4 text-neutral-600 transition-transform ${isOpen ? 'rotate-90 text-[#22c55e]' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="p-4 pt-0 text-[10px] leading-relaxed text-neutral-500 border-t border-neutral-900/60">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* D. HELP & SUPPORT SUB-SCREEN */}
          {profileSub === 'help' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-2">Help & Support</h3>
              <p className="text-[10px] text-neutral-500 mb-6">Need support? Contact the turf management directly or leave a message below.</p>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <a
                  href="https://wa.me/919876543210?text=Hello%20Golden%20Arm%20Turf%20support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 border border-neutral-900 bg-neutral-950/40 text-center flex flex-col items-center hover:border-[#22c55e] transition"
                >
                  <MessageSquare className="w-6 h-6 text-[#22c55e] mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">WhatsApp Help</span>
                  <span className="text-[8px] text-neutral-600 mt-1">Instant Response</span>
                </a>
                <a
                  href="tel:+919876543210"
                  className="p-4 border border-neutral-900 bg-neutral-950/40 text-center flex flex-col items-center hover:border-[#22c55e] transition"
                >
                  <Phone className="w-6 h-6 text-[#22c55e] mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-300">Call Counter</span>
                  <span className="text-[8px] text-neutral-600 mt-1">Direct Helpline</span>
                </a>
              </div>

              <div className="border border-neutral-900 p-5 bg-neutral-950/20">
                <h4 className="text-xs font-bold text-neutral-300 uppercase mb-4">Send a Support Message</h4>
                {supportSuccess && (
                  <div className="p-3 mb-4 border border-[#22c55e]/20 bg-[#22c55e]/10 text-[10px] text-[#22c55e] font-bold">
                    {supportSuccess}
                  </div>
                )}
                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  <div>
                    <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">
                      Your Issue or Inquiry
                    </label>
                    <textarea
                      required
                      rows="4"
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="Type your message here..."
                      className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e] transition"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition"
                  >
                    Submit Ticket
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* E. SETTINGS SUB-SCREEN */}
          {profileSub === 'settings' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-5">App Settings</h3>

              <div className="space-y-5">
                <div>
                  <h4 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2.5 px-1">Notification Preferences</h4>
                  <div className="border border-neutral-900 bg-neutral-950/20 divide-y divide-neutral-900/60 p-1">
                    <div className="p-3.5 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-neutral-300 block">SMS Alerts</span>
                        <span className="text-[8px] text-neutral-600">Receive booking confirmations via SMS</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settingsSMS} 
                        onChange={() => setSettingsSMS(!settingsSMS)}
                        className="w-4 h-4 accent-[#22c55e] bg-neutral-950 border-neutral-900 cursor-pointer"
                      />
                    </div>
                    <div className="p-3.5 flex justify-between items-center">
                      <div>
                        <span className="text-xs font-bold text-neutral-300 block">WhatsApp Messages</span>
                        <span className="text-[8px] text-neutral-600">Send vouchers directly to WhatsApp</span>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settingsWA} 
                        onChange={() => setSettingsWA(!settingsWA)}
                        className="w-4 h-4 accent-[#22c55e] bg-neutral-950 border-neutral-900 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest block mb-2 px-1">
                    Application Language
                  </label>
                  <select
                    value={settingsLang}
                    onChange={(e) => setSettingsLang(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-900 rounded-none p-3 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                  >
                    <option value="english">English</option>
                    <option value="malayalam">മലയാളം (Malayalam)</option>
                  </select>
                </div>

                <div className="border-t border-neutral-900 pt-5">
                  <h4 className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest mb-2 px-1">Linked Account</h4>
                  <div className="border border-neutral-900 bg-neutral-950/20 p-4">
                    <span className="text-[9px] text-neutral-500 uppercase block font-bold">Linked Phone Number</span>
                    <span className="text-xs font-bold text-white mt-1 block">{profile.phone}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (confirm('Confirm log out from current profile? (This clears local storage settings)')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="w-full py-4 border border-red-500 text-red-500 font-bold text-xs uppercase tracking-wider rounded-none hover:bg-red-500/5 transition mt-6"
                >
                  Log Out Profile
                </button>
              </div>
            </div>
          )}

          {/* F. CANCELLATION BOARD */}
          {profileSub === 'cancel-board' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-2">Cancel Bookings</h3>
              <p className="text-[9px] text-red-500 uppercase font-bold tracking-wider mb-5 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Cutoff: Min. 4 hours before slot time
              </p>

              {cancelError && (
                <div className="p-3 mb-4 border border-red-950 bg-red-955/20 text-xs text-red-500 font-bold">
                  {cancelError}
                </div>
              )}

              {(() => {
                const activeBookings = myBookings.filter(b => b.booking_status === 'confirmed');
                
                if (activeBookings.length === 0) {
                  return (
                    <div className="border border-neutral-900 bg-neutral-950/20 p-6 text-center">
                      <XCircle className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                      <p className="text-xs font-bold text-neutral-400 mb-1 uppercase tracking-wider">No Active Bookings</p>
                      <p className="text-[10px] text-neutral-500 max-w-[200px] mx-auto">
                        There are no active booking passes registered to cancel.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4 max-h-[55vh] overflow-y-auto no-scrollbar pr-1 pb-6">
                    {activeBookings.map((b) => {
                      const isDeleting = cancelingId === b.id;

                      return (
                        <div key={b.id} className="border border-neutral-900 bg-neutral-950/40 p-4">
                          <div className="text-[9px] font-mono text-neutral-600 uppercase mb-2">
                            ID: {b.id.substring(0, 8).toUpperCase()}
                          </div>

                          <div className="text-sm font-black text-white uppercase">
                            {formatTime12h(b.slot.start_time)} - {formatTime12h(b.slot.end_time)}
                          </div>

                          <div className="text-xs font-bold text-neutral-400 mt-1">
                            Date: {formatDateDisplayShort(b.slot.date)}
                          </div>

                          <div className="mt-4 pt-3 border-t border-neutral-900/60 flex items-center justify-between">
                            <button
                              onClick={() => setActiveCancellation(b)}
                              disabled={isDeleting}
                              className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 disabled:opacity-50 text-[10px] font-bold uppercase tracking-wider transition"
                            >
                              Cancel Booking
                            </button>
                            <span className="text-[10px] font-bold text-[#22c55e]">
                              ₹{b.slot.price}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* G. INVITE A FRIEND */}
          {profileSub === 'invite' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-2">Invite a Friend</h3>
              <p className="text-[10px] text-neutral-500 mb-6">Invite friends to play and book at Golden Arm Turf.</p>

              <div className="border border-neutral-900 bg-neutral-950/20 p-5 text-center flex flex-col items-center">
                <Share2 className="w-10 h-10 text-[#22c55e] mb-3" />
                <h4 className="text-xs font-bold text-white uppercase mb-1">Referral Invitation</h4>
                <p className="text-[10px] text-neutral-500 mb-5 max-w-[220px]">
                  Copy the referral link below and send it to your football group.
                </p>

                <div className="w-full bg-[#070707] border border-neutral-900 p-3 text-[10px] font-mono text-neutral-400 text-left select-all mb-4 break-all">
                  Hey! Play at Golden Arm Turf. Book slots here: http://localhost:5173/
                </div>

                <button
                  onClick={handleInviteCopy}
                  className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000]"
                >
                  {inviteCopied ? 'Link Copied!' : 'Copy Referral Message'}
                </button>
              </div>
            </div>
          )}

          {/* H. RATE OUR APP */}
          {profileSub === 'rate' && (
            <div className="animate-in fade-in duration-200">
              <button 
                onClick={() => setProfileSub(null)}
                className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6 flex items-center gap-1 hover:text-white"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>

              <h3 className="text-base font-black text-white uppercase mb-2">Rate Us</h3>
              <p className="text-[10px] text-neutral-500 mb-6">Your feedback helps us provide a better playing experience.</p>

              <div className="border border-neutral-900 p-5 bg-neutral-950/20">
                {ratingSubmitted ? (
                  <div className="py-8 text-center flex flex-col items-center">
                    <CheckCircle className="w-12 h-12 text-[#22c55e] mb-3" />
                    <h4 className="text-xs font-bold text-white uppercase mb-1">Thank you!</h4>
                    <p className="text-[10px] text-neutral-500">Your feedback has been submitted successfully.</p>
                  </div>
                ) : (
                  <form onSubmit={handleRatingSubmit} className="space-y-5">
                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2 px-1">
                        Select Rating
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRatingVal(star)}
                            className="p-1 hover:scale-110 transition"
                          >
                            <Star className={`w-8 h-8 ${star <= ratingVal ? 'text-[#22c55e] fill-[#22c55e]' : 'text-neutral-700'}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">
                        Review / Suggestions
                      </label>
                      <textarea
                        rows="3"
                        value={ratingFeedback}
                        onChange={(e) => setRatingFeedback(e.target.value)}
                        placeholder="Tell us what you think..."
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e] transition"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition"
                    >
                      Submit Feedback
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

        </main>
      )}

      {/* --- FIXED BOTTOM NAVIGATION BAR --- */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-neutral-950 border-t border-neutral-900 py-3 px-6 grid grid-cols-4 gap-1 text-center z-40">
        <button
          onClick={() => { setCurrentTab('home'); setProfileSub(null); setConfirmedBooking(null); }}
          className={`flex flex-col items-center gap-1 transition ${currentTab === 'home' ? 'text-[#22c55e]' : 'text-neutral-500'}`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
        </button>
        
        <button
          onClick={() => { setCurrentTab('book'); setProfileSub(null); setConfirmedBooking(null); }}
          className={`flex flex-col items-center gap-1 transition ${currentTab === 'book' ? 'text-[#22c55e]' : 'text-neutral-500'}`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Book</span>
        </button>

        <button
          onClick={() => { setCurrentTab('passes'); setProfileSub(null); }}
          className={`flex flex-col items-center gap-1 transition ${currentTab === 'passes' ? 'text-[#22c55e]' : 'text-neutral-500'}`}
        >
          <History className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Passes</span>
        </button>

        <button
          onClick={() => { setCurrentTab('profile'); setProfileSub(null); setConfirmedBooking(null); }}
          className={`flex flex-col items-center gap-1 transition ${currentTab === 'profile' ? 'text-[#22c55e]' : 'text-neutral-500'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Profile</span>
        </button>
      </nav>

      {/* --- PHOTO LIGHTBOX PORTAL OVERLAY --- */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-6 animate-in fade-in duration-200">
          <div className="flex justify-between items-center w-full max-w-md mx-auto">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#22c55e]">
              Image {lightboxIndex + 1} of {galleryImages.length}
            </span>
            <button 
              onClick={() => setLightboxOpen(false)}
              className="p-2 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative flex-grow flex items-center justify-center w-full max-w-md mx-auto">
            <button
              onClick={handleLightboxPrev}
              className="absolute left-0 p-3 bg-neutral-950/80 border border-neutral-900 text-neutral-400 hover:text-white rounded-none hover:border-neutral-700 transition z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <img 
              src={galleryImages[lightboxIndex].src} 
              alt={galleryImages[lightboxIndex].caption} 
              className="max-w-full max-h-[60vh] object-contain border border-neutral-900"
            />

            <button
              onClick={handleLightboxNext}
              className="absolute right-0 p-3 bg-neutral-950/80 border border-neutral-900 text-neutral-400 hover:text-white rounded-none hover:border-neutral-700 transition z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center w-full max-w-md mx-auto pb-4">
            <p className="text-xs font-bold text-white uppercase tracking-wider">
              {galleryImages[lightboxIndex].caption}
            </p>
            <span className="text-[9px] text-neutral-600 uppercase tracking-widest font-bold mt-1 block">
              Golden Arm Turf • Alakode
            </span>
          </div>
        </div>
      )}

      {/* BOOKING MODAL (BOTTOM DRAWER) */}
      {selectedSlot && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-end justify-center p-4">
          <div className="absolute inset-0" onClick={handleCloseBooking}></div>

          <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-none relative z-10 p-5 transform translate-y-0 transition duration-300 animate-in slide-in-from-bottom duration-300">
            
            <div className="mb-4 pb-3 border-b border-neutral-900">
              <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-widest">
                Slot Reservation
              </span>
              <h3 className="text-lg font-black text-white mt-1 uppercase">
                {formatTime12h(selectedSlot.start_time)} to {formatTime12h(selectedSlot.end_time)}
              </h3>
              <p className="text-[10px] text-neutral-400 mt-1 uppercase font-semibold">
                Date: {formatDateDisplayShort(selectedSlot.date)}
              </p>
            </div>

            {bookingError && (
              <div className="p-3 mb-4 border border-red-950 bg-red-950/20 text-xs text-red-500 font-bold">
                {bookingError}
              </div>
            )}

            {bookingLoading && !holdData ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#22c55e] animate-spin mb-2" />
                <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Reserving your slot...</p>
              </div>
            ) : holdData ? (
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                {/* Hold Timer Alert Banner */}
                <div className="p-2.5 border border-amber-950/60 bg-amber-950/10 text-amber-500 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Slot held for payment
                  </span>
                  <span className="font-mono text-xs">
                    {Math.floor(holdTimeLeft / 60)}:{(holdTimeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Player details */}
                <div className="space-y-2 bg-neutral-900/20 border border-neutral-900 p-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Player</span>
                    <span className="font-black text-white uppercase">{user?.name}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-widest">Phone</span>
                    <span className="font-bold text-neutral-400">+91 {user?.phone}</span>
                  </div>
                </div>

                {/* Payment Breakdown Box */}
                <div className="bg-neutral-950 border border-[#22c55e]/20 p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Total Slot Price</span>
                    <span className="font-bold text-white">₹{holdData.totalAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-b border-neutral-900 pb-2">
                    <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-wider flex items-center gap-1">
                      Advance Due Now (40%)
                    </span>
                    <span className="font-black text-[#22c55e] text-sm">₹{holdData.advanceAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Balance at Venue</span>
                    <span className="font-bold text-neutral-300">₹{holdData.balanceAmount}</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseBooking}
                    className="flex-1 py-3 border border-neutral-900 text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-wider rounded-none transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bookingLoading || holdTimeLeft <= 0}
                    className="flex-2 py-3 bg-[#22c55e] hover:bg-[#1db252] disabled:opacity-50 text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] transition flex items-center justify-center gap-1.5"
                  >
                    {bookingLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> PAYING...
                      </>
                    ) : (
                      `PAY ADVANCE ₹${holdData.advanceAmount}`
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleCloseBooking}
                  className="w-full py-3 bg-neutral-900 hover:bg-neutral-850 text-white font-bold text-xs uppercase tracking-wider rounded-none transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CANCELLATION CONFIRMATION MODAL (BOTTOM DRAWER) */}
      {activeCancellation && (() => {
        const b = activeCancellation;
        const [year, month, day] = b.slot.date.split('-').map(Number);
        const [hour, minute] = b.slot.start_time.split(':').map(Number);
        const slotStartTime = new Date(year, month - 1, day, hour, minute, 0, 0);
        const isPastDeadline = b.cancellation_deadline ? new Date(b.cancellation_deadline) <= new Date() : true;

        const closeCancelModal = () => {
          setActiveCancellation(null);
          setCancelSuccessData(null);
          setCancelError('');
        };

        if (cancelSuccessData) {
          return (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-end justify-center p-4">
              <div className="absolute inset-0" onClick={closeCancelModal}></div>

              <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-none relative z-10 p-6 text-center transform translate-y-0 transition duration-300 animate-in slide-in-from-bottom duration-300">
                
                <div className="w-12 h-12 bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/30 mb-4 mx-auto">
                  <CheckCircle className="w-7 h-7 text-[#22c55e]" />
                </div>

                <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">
                  Cancellation Confirmed
                </h3>
                
                <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mb-4">
                  Ref: {b.id.substring(0, 8).toUpperCase()}
                </p>

                <div className="p-4 border border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e] text-xs font-bold uppercase tracking-wider mb-5">
                  {cancelSuccessData.message}
                </div>

                <button
                  type="button"
                  onClick={closeCancelModal}
                  className="w-full py-3 bg-[#22c55e] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition"
                >
                  Okay
                </button>

              </div>
            </div>
          );
        }

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-xs z-50 flex items-end justify-center p-4">
            <div className="absolute inset-0" onClick={closeCancelModal}></div>

            <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-none relative z-10 p-5 transform translate-y-0 transition duration-300 animate-in slide-in-from-bottom duration-300">
              
              <div className="mb-4 pb-3 border-b border-neutral-900">
                <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Cancel Booking
                </span>
                <h3 className="text-lg font-black text-white mt-1 uppercase">
                  {formatTime12h(b.slot.start_time)} to {formatTime12h(b.slot.end_time)}
                </h3>
                <p className="text-[10px] text-neutral-400 mt-1 uppercase font-semibold">
                  Date: {formatDateDisplayShort(b.slot.date)}
                </p>
              </div>

              {cancelError && (
                <div className="p-3 mb-4 border border-red-955 bg-red-955/20 text-xs text-red-500 font-bold">
                  {cancelError}
                </div>
              )}

              <div className="space-y-4">
                {/* Cancellation Policy Banner */}
                <div className={`p-4 border text-[11px] font-bold uppercase tracking-wider leading-relaxed ${
                  !isPastDeadline 
                    ? 'border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e]' 
                    : 'border-amber-500/30 bg-amber-500/5 text-amber-500'
                }`}>
                  {!isPastDeadline ? (
                    <div>
                      <p className="font-extrabold mb-1">Eligible for Full Refund</p>
                      <p className="text-[9px] text-neutral-400 normal-case font-medium">
                        You are cancelling before the 4-hour window. A full refund of ₹{b.advance_paid_amount} will be processed back to your original payment method.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-extrabold mb-1 text-red-500">Non-Refundable Cancellation</p>
                      <p className="text-[9px] text-neutral-400 normal-case font-medium">
                        Cancellations within 4 hours of slot start are not eligible for a refund. No refund will be issued, and the slot will remain blocked.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={cancelingId === b.id}
                    onClick={closeCancelModal}
                    className="flex-1 py-3 border border-neutral-900 text-neutral-500 hover:text-white font-bold text-xs uppercase tracking-wider rounded-none transition"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    disabled={cancelingId === b.id}
                    onClick={() => handleCancelBooking(b.id)}
                    className="flex-2 py-3 bg-red-600 hover:bg-red-750 disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] transition flex items-center justify-center gap-1.5"
                  >
                    {cancelingId === b.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling...
                      </>
                    ) : (
                      'Confirm Cancel'
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}

// ==========================================
// ADMIN DASHBOARD APPLICATION (STEP 4)
// ==========================================
function AdminApp() {
  const [adminToken, setAdminToken] = useState(localStorage.getItem('admin_token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Nav Tab
  const [activeTab, setActiveTab] = useState('today');

  // Today Tab Date
  const getISTTodayDateString = () => {
    const d = new Date();
    // Convert to IST (UTC +5:30)
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const nd = new Date(utc + (3600000 * 5.5));
    const year = nd.getFullYear();
    const month = String(nd.getMonth() + 1).padStart(2, '0');
    const day = String(nd.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [todayDate, setTodayDate] = useState(getISTTodayDateString());

  // Calendar tab date
  const [calendarDate, setCalendarDate] = useState(getISTTodayDateString());
  const [calendarSlots, setCalendarSlots] = useState([]);
  const [selectedSlotDetails, setSelectedSlotDetails] = useState(null);

  // Block Slots tab state
  const [blockDate, setBlockDate] = useState(getISTTodayDateString());
  const [blockSlotsList, setBlockSlotsList] = useState([]);
  const [selectedBlockSlotIds, setSelectedBlockSlotIds] = useState([]);

  // Data state
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  
  // Settings Form State
  const [turfName, setTurfName] = useState('');
  const [hoursStart, setHoursStart] = useState('');
  const [hoursEnd, setHoursEnd] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(1200);
  const [advancePct, setAdvancePct] = useState(40);
  const [cancelHours, setCancelHours] = useState(4);
  const [sports, setSports] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Auto-refresh when tab changes
  useEffect(() => {
    if (!adminToken) return;
    loadTabData();
  }, [activeTab, todayDate, calendarDate, blockDate, adminToken]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'today') {
        await fetchBookingsToday();
      } else if (activeTab === 'calendar') {
        await fetchCalendarSlots();
      } else if (activeTab === 'block') {
        await fetchBlockSlots();
      } else if (activeTab === 'pending') {
        await fetchPendingBalances();
      } else if (activeTab === 'cancellations') {
        await fetchCancellations();
      } else if (activeTab === 'settings') {
        await fetchSettings();
      } else if (activeTab === 'stats') {
        await fetchStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingsToday = async () => {
    const res = await fetch(`/api/admin/bookings?date=${todayDate}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data);
    }
  };

  const fetchCalendarSlots = async () => {
    const slotsRes = await fetch(`/api/slots?date=${calendarDate}`);
    if (slotsRes.ok) {
      const slotsData = await slotsRes.json();
      setCalendarSlots(slotsData);
    }
    const bRes = await fetch(`/api/admin/bookings?date=${calendarDate}`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (bRes.ok) {
      const bData = await bRes.json();
      setBookings(bData);
    }
  };

  const fetchBlockSlots = async () => {
    const slotsRes = await fetch(`/api/slots?date=${blockDate}`);
    if (slotsRes.ok) {
      const slotsData = await slotsRes.json();
      setBlockSlotsList(slotsData);
      setSelectedBlockSlotIds([]);
    }
  };

  const fetchPendingBalances = async () => {
    const res = await fetch('/api/admin/bookings?balance_payment_status=pending&booking_status=confirmed', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data);
    }
  };

  const fetchCancellations = async () => {
    const res = await fetch('/api/admin/bookings?booking_status=cancelled', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data);
    }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/settings', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
      setTurfName(data.turf_name);
      setHoursStart(data.operating_hours_start);
      setHoursEnd(data.operating_hours_end);
      setDuration(data.slot_duration_minutes);
      setPrice(data.price_per_slot);
      setAdvancePct(data.advance_payment_percentage);
      setCancelHours(data.cancellation_window_hours);
      setSports(data.sport_types_offered);
      setSettingsSuccess('');
    }
  };

  const fetchStats = async () => {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      localStorage.setItem('admin_token', data.token);
      setAdminToken(data.token);
    } catch (err) {
      setLoginError(err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminSignOut = () => {
    localStorage.removeItem('admin_token');
    setAdminToken(null);
    window.location.reload();
  };

  const markBalancePaid = async (bookingId) => {
    if (!confirm('Mark balance payment as paid at venue?')) return;
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/pay-balance`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadTabData();
        if (selectedSlotDetails && selectedSlotDetails.booking && selectedSlotDetails.booking.id === bookingId) {
          setSelectedSlotDetails({
            ...selectedSlotDetails,
            booking: {
              ...selectedSlotDetails.booking,
              balance_payment_status: 'paid_at_venue'
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const markCompleted = async (bookingId) => {
    if (!confirm('Mark booking as completed?')) return;
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadTabData();
        if (selectedSlotDetails && selectedSlotDetails.booking && selectedSlotDetails.booking.id === bookingId) {
          setSelectedSlotDetails({
            ...selectedSlotDetails,
            booking: {
              ...selectedSlotDetails.booking,
              booking_status: 'completed'
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const markNoShow = async (bookingId) => {
    if (!confirm('Mark player as no-show?')) return;
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/no-show`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        await loadTabData();
        if (selectedSlotDetails && selectedSlotDetails.booking && selectedSlotDetails.booking.id === bookingId) {
          setSelectedSlotDetails({
            ...selectedSlotDetails,
            booking: {
              ...selectedSlotDetails.booking,
              booking_status: 'no_show'
            }
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleBlockSlot = async (slot, shouldBlock) => {
    setActionLoadingId(slot.id);
    try {
      const url = shouldBlock ? '/api/admin/slots/block' : '/api/admin/slots/unblock';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ slot_ids: [slot.id] })
      });
      if (res.ok) {
        await loadTabData();
        setSelectedSlotDetails(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkBlockAction = async (shouldBlock) => {
    if (selectedBlockSlotIds.length === 0) return;
    setLoading(true);
    try {
      const url = shouldBlock ? '/api/admin/slots/block' : '/api/admin/slots/unblock';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ slot_ids: selectedBlockSlotIds })
      });
      if (res.ok) {
        await loadTabData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingsSave = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          turf_name: turfName,
          operating_hours_start: hoursStart,
          operating_hours_end: hoursEnd,
          slot_duration_minutes: duration,
          price_per_slot: price,
          advance_payment_percentage: advancePct,
          cancellation_window_hours: cancelHours,
          sport_types_offered: sports
        })
      });
      if (res.ok) {
        setSettingsSuccess('Settings updated successfully!');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-neutral-900 bg-neutral-950 p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="inline-flex w-12 h-12 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 items-center justify-center text-xl font-black text-[#22c55e] mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white">Admin Control Panel</h2>
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mt-1">Golden Arm Turf Manager</p>
          </div>

          {loginError && (
            <div className="mb-6 p-4 border border-red-955 bg-red-955/20 text-xs text-red-500 font-bold uppercase tracking-wide">
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-5">
            <div>
              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Admin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@goldenarm.com"
                className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e]"
              />
            </div>

            <div>
              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white placeholder-neutral-700 focus:outline-none focus:border-[#22c55e]"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-4 bg-[#22c55e] text-black font-black uppercase text-xs tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log In Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-neutral-900 bg-neutral-950 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-8">
          <div className="border-b border-neutral-900 pb-5">
            <span className="text-[9px] font-bold text-[#22c55e] uppercase tracking-widest block mb-1">Live Control</span>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">Turf Admin Board</h2>
          </div>

          <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible no-scrollbar gap-1">
            {[
              { id: 'today', label: 'Today\'s Bookings' },
              { id: 'calendar', label: 'Calendar Grid' },
              { id: 'block', label: 'Block Slots' },
              { id: 'pending', label: 'Pending Balances' },
              { id: 'cancellations', label: 'Cancellations Log' },
              { id: 'settings', label: 'Turf Settings' },
              { id: 'stats', label: 'Stats Analytics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedSlotDetails(null); }}
                className={`py-3 px-4 text-[10px] font-bold uppercase tracking-wider rounded-none text-left whitespace-nowrap transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#22c55e]/10 border-l-2 border-[#22c55e] text-[#22c55e]'
                    : 'text-neutral-500 hover:text-white hover:bg-neutral-900/30'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-neutral-900 mt-6 md:mt-0">
          <button
            onClick={handleAdminSignOut}
            className="w-full py-3 border border-red-955 bg-red-955/5 hover:bg-red-955/15 text-red-500 font-extrabold text-[10px] uppercase tracking-wider rounded-none transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {loading && !actionLoadingId ? (
          <div className="min-h-[50vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'today' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
                  <div>
                    <h2 className="text-xl font-black uppercase text-white tracking-tight">Today's Bookings</h2>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">List and verify all game check-ins</p>
                  </div>
                  <input
                    type="date"
                    value={todayDate}
                    onChange={(e) => setTodayDate(e.target.value)}
                    className="bg-neutral-950 border border-neutral-900 p-2 text-xs font-bold text-white focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                {bookings.length === 0 ? (
                  <div className="border border-neutral-900 p-10 bg-neutral-950/20 text-center uppercase tracking-wide">
                    <p className="text-xs font-bold text-neutral-400">No Bookings Found</p>
                    <p className="text-[9px] text-neutral-600 mt-1">There are no records for {todayDate}</p>
                  </div>
                ) : (
                  <div className="border border-neutral-900 bg-neutral-950/20 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-900 text-[9px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-950/60">
                          <th className="p-4">Time Block</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4">Finance Details</th>
                          <th className="p-4 text-center">Payment Status</th>
                          <th className="p-4 text-center">Booking Status</th>
                          <th className="p-4 text-right">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/60 font-medium">
                        {bookings.map(b => (
                          <tr key={b.id} className="hover:bg-neutral-950/40 transition">
                            <td className="p-4 font-black text-white">
                              {formatTime12h(b.start_time)} - {formatTime12h(b.end_time)}
                            </td>
                            <td className="p-4">
                              <span className="text-white font-extrabold uppercase block">{b.customer_name}</span>
                              <span className="text-neutral-500 text-[10px] mt-0.5 block">{b.customer_phone}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-white block font-bold">Total: ₹{b.total_amount}</span>
                              <span className="text-[#22c55e] text-[10px] block">Paid Adv: ₹{b.advance_paid_amount}</span>
                            </td>
                            <td className="p-4 text-center">
                              {b.balance_payment_status === 'paid_at_venue' ? (
                                <span className="inline-block px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/30 text-[9px] font-black uppercase">Paid at Venue</span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/30 text-[9px] font-black uppercase">Pending Bal (₹{b.balance_amount})</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <span className={`inline-block px-2.5 py-0.5 text-[9px] font-black uppercase border ${
                                b.booking_status === 'confirmed' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30' :
                                b.booking_status === 'completed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                b.booking_status === 'no_show' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                                'bg-neutral-800 text-neutral-400 border-neutral-700/50'
                              }`}>
                                {b.booking_status}
                              </span>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              {b.balance_payment_status === 'pending' && b.booking_status === 'confirmed' && (
                                <button
                                  disabled={actionLoadingId === b.id}
                                  onClick={() => markBalancePaid(b.id)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider rounded-none cursor-pointer"
                                >
                                  {actionLoadingId === b.id ? 'Saving...' : 'Collect Bal'}
                                </button>
                              )}
                              {b.booking_status === 'confirmed' && (
                                <>
                                  <button
                                    disabled={actionLoadingId === b.id}
                                    onClick={() => markCompleted(b.id)}
                                    className="px-2 py-1 bg-[#22c55e] hover:bg-[#1db252] text-black font-extrabold text-[9px] uppercase tracking-wider rounded-none cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    disabled={actionLoadingId === b.id}
                                    onClick={() => markNoShow(b.id)}
                                    className="px-2 py-1 bg-red-650 hover:bg-red-800 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-none cursor-pointer"
                                  >
                                    No-Show
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
                  <div>
                    <h2 className="text-xl font-black uppercase text-white tracking-tight">Calendar Grid</h2>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">View slot statuses and details</p>
                  </div>
                  <input
                    type="date"
                    value={calendarDate}
                    onChange={(e) => { setCalendarDate(e.target.value); setSelectedSlotDetails(null); }}
                    className="bg-neutral-950 border border-neutral-900 p-2 text-xs font-bold text-white focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">Slots Board ({calendarDate})</h3>
                    {calendarSlots.length === 0 ? (
                      <div className="border border-neutral-900 p-10 bg-neutral-950/20 text-center">
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">No Slots Seeded</p>
                        <p className="text-[9px] text-neutral-600 mt-1 uppercase">Click Settings to verify operating hours and price.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {calendarSlots.map(slot => {
                          const hasB = bookings.find(b => b.slot_id === slot.id);
                          let borderClass = 'border-neutral-900 text-neutral-500';
                          let bgClass = 'bg-neutral-950/30';
                          if (slot.status === 'available') {
                            borderClass = 'border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/5';
                          } else if (slot.status === 'booked') {
                            borderClass = 'border-red-500/30 text-red-500 hover:bg-red-500/5';
                          } else if (slot.status === 'blocked') {
                            borderClass = 'border-neutral-800 text-neutral-700 hover:bg-neutral-900/10';
                            bgClass = 'bg-neutral-900/20';
                          } else if (slot.status === 'held') {
                            borderClass = 'border-amber-500/30 text-amber-500 hover:bg-amber-500/5';
                          }

                          const isActive = selectedSlotDetails && selectedSlotDetails.id === slot.id;

                          return (
                            <button
                              key={slot.id}
                              onClick={() => setSelectedSlotDetails({ ...slot, booking: hasB })}
                              className={`p-3 border text-left rounded-none transition flex flex-col justify-between cursor-pointer ${borderClass} ${bgClass} ${
                                isActive ? 'ring-1 ring-white' : ''
                              }`}
                            >
                              <span className="text-[10px] font-black uppercase tracking-tight block">
                                {formatTime12h(slot.start_time)}
                              </span>
                              <span className="text-[8px] uppercase tracking-widest font-extrabold mt-2 block">
                                {slot.status}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">Slot Details</h3>
                    {selectedSlotDetails ? (
                      <div className="border border-neutral-900 bg-neutral-950 p-5 space-y-5 animate-in fade-in duration-200">
                        <div>
                          <span className={`text-[8px] border px-2 py-0.5 font-black uppercase tracking-widest ${
                            selectedSlotDetails.status === 'available' ? 'border-[#22c55e] text-[#22c55e]' :
                            selectedSlotDetails.status === 'booked' ? 'border-red-500 text-red-500' :
                            selectedSlotDetails.status === 'blocked' ? 'border-neutral-700 text-neutral-500' :
                            'border-amber-500 text-amber-500'
                          }`}>
                            {selectedSlotDetails.status}
                          </span>
                          <h3 className="text-base font-black text-white mt-3 uppercase">
                            {formatTime12h(selectedSlotDetails.start_time)} - {formatTime12h(selectedSlotDetails.end_time)}
                          </h3>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase mt-1">Date: {formatDateDisplayShort(selectedSlotDetails.date)}</p>
                        </div>

                        {selectedSlotDetails.status === 'booked' && selectedSlotDetails.booking && (
                          <div className="space-y-3 pt-3 border-t border-neutral-900 text-xs">
                            <div>
                              <span className="text-[9px] text-neutral-500 uppercase font-black block">Customer Name</span>
                              <span className="text-white font-extrabold uppercase block">{selectedSlotDetails.booking.customer_name}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500 uppercase font-black block">Phone Number</span>
                              <span className="text-white font-bold block">{selectedSlotDetails.booking.customer_phone}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500 uppercase font-black block">Advance Payment Status</span>
                              <span className="text-[#22c55e] font-bold block">Paid: ₹{selectedSlotDetails.booking.advance_paid_amount}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-neutral-500 uppercase font-black block">Venue Balance Status</span>
                              {selectedSlotDetails.booking.balance_payment_status === 'paid_at_venue' ? (
                                <span className="text-[#22c55e] font-bold block">Paid: ₹{selectedSlotDetails.booking.balance_amount}</span>
                              ) : (
                                <span className="text-amber-500 font-bold block">Pending: ₹{selectedSlotDetails.booking.balance_amount}</span>
                              )}
                            </div>

                            <div className="pt-4 border-t border-neutral-900/60 flex flex-wrap gap-2">
                              {selectedSlotDetails.booking.balance_payment_status === 'pending' && (
                                <button
                                  disabled={actionLoadingId === selectedSlotDetails.id}
                                  onClick={() => markBalancePaid(selectedSlotDetails.booking.id)}
                                  className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-black font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                                >
                                  Collect Balance
                                </button>
                              )}
                              {selectedSlotDetails.booking.booking_status === 'confirmed' && (
                                <>
                                  <button
                                    disabled={actionLoadingId === selectedSlotDetails.id}
                                    onClick={() => markCompleted(selectedSlotDetails.booking.id)}
                                    className="py-2 px-3 bg-[#22c55e] hover:bg-[#1db252] text-black font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                  <button
                                    disabled={actionLoadingId === selectedSlotDetails.id}
                                    onClick={() => markNoShow(selectedSlotDetails.booking.id)}
                                    className="py-2 px-3 bg-red-650 hover:bg-red-800 text-white font-bold text-[9px] uppercase tracking-wider cursor-pointer"
                                  >
                                    No-Show
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedSlotDetails.status === 'available' && (
                          <div className="pt-3 border-t border-neutral-900">
                            <button
                              disabled={actionLoadingId === selectedSlotDetails.id}
                              onClick={() => toggleBlockSlot(selectedSlotDetails, true)}
                              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs uppercase tracking-wider rounded-none cursor-pointer"
                            >
                              {actionLoadingId === selectedSlotDetails.id ? 'Processing...' : 'Block Slot'}
                            </button>
                          </div>
                        )}

                        {selectedSlotDetails.status === 'blocked' && (
                          <div className="pt-3 border-t border-neutral-900">
                            <button
                              disabled={actionLoadingId === selectedSlotDetails.id}
                              onClick={() => toggleBlockSlot(selectedSlotDetails, false)}
                              className="w-full py-3 bg-[#22c55e] hover:bg-[#1db252] text-black font-extrabold text-xs uppercase tracking-wider rounded-none shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                              {actionLoadingId === selectedSlotDetails.id ? 'Processing...' : 'Unblock Slot'}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="border border-neutral-900 border-dashed p-6 text-center text-xs text-neutral-500 uppercase tracking-wider">
                        Select a slot on the grid to inspect details
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'block' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-5">
                  <div>
                    <h2 className="text-xl font-black uppercase text-white tracking-tight">Block Slots</h2>
                    <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Bulk-manage slot maintenance blocks</p>
                  </div>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="bg-neutral-950 border border-neutral-900 p-2 text-xs font-bold text-white focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                <div className="border border-neutral-900 bg-neutral-950 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-neutral-900">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      {selectedBlockSlotIds.length} Slots Selected
                    </span>
                    <div className="space-x-3">
                      <button
                        onClick={() => setSelectedBlockSlotIds([])}
                        className="text-xs text-neutral-500 hover:text-white cursor-pointer"
                      >
                        Clear Selection
                      </button>
                      <button
                        disabled={selectedBlockSlotIds.length === 0}
                        onClick={() => handleBulkBlockAction(true)}
                        className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 text-[9px] font-bold uppercase tracking-wider disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                      >
                        Block Selected
                      </button>
                      <button
                        disabled={selectedBlockSlotIds.length === 0}
                        onClick={() => handleBulkBlockAction(false)}
                        className="px-4 py-2 bg-[#22c55e] text-black hover:bg-[#1db252] text-[9px] font-extrabold uppercase tracking-wider disabled:opacity-30 disabled:hover:bg-[#22c55e] cursor-pointer"
                      >
                        Unblock Selected
                      </button>
                    </div>
                  </div>

                  {blockSlotsList.length === 0 ? (
                    <div className="p-8 text-center text-neutral-500 text-xs uppercase font-bold">
                      No slots generated for this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {blockSlotsList.map(slot => {
                        const isBooked = slot.status === 'booked';
                        const isHeld = slot.status === 'held';
                        const isChecked = selectedBlockSlotIds.includes(slot.id);
                        
                        return (
                          <label
                            key={slot.id}
                            className={`p-4 border text-xs font-bold uppercase cursor-pointer flex items-center gap-3 transition select-none ${
                              isBooked || isHeld ? 'border-neutral-900 bg-neutral-950/20 text-neutral-700 cursor-not-allowed' :
                              isChecked ? 'border-white bg-neutral-900 text-white' :
                              slot.status === 'blocked' ? 'border-neutral-800 text-neutral-500 bg-neutral-950/20' :
                              'border-neutral-900 text-neutral-400 hover:border-neutral-750'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={isBooked || isHeld}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBlockSlotIds([...selectedBlockSlotIds, slot.id]);
                                } else {
                                  setSelectedBlockSlotIds(selectedBlockSlotIds.filter(id => id !== slot.id));
                                }
                              }}
                              className="w-4 h-4 accent-[#22c55e]"
                            />
                            <div className="flex-1">
                              <span className="block font-black">{formatTime12h(slot.start_time)}</span>
                              <span className="text-[8px] text-neutral-500 uppercase tracking-widest mt-1 block">
                                Status: {slot.status} {isBooked ? '(Cannot edit)' : ''}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="space-y-6">
                <div className="border-b border-neutral-900 pb-5">
                  <h2 className="text-xl font-black uppercase text-white tracking-tight">Pending Balances</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Collect balances on game dates</p>
                </div>

                {bookings.length === 0 ? (
                  <div className="border border-neutral-900 p-10 bg-neutral-950/20 text-center uppercase tracking-wide">
                    <p className="text-xs font-bold text-neutral-400">All Balances Paid</p>
                    <p className="text-[9px] text-neutral-600 mt-1">There are no pending balances recorded</p>
                  </div>
                ) : (
                  <div className="border border-neutral-900 bg-neutral-950/20 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-900 text-[9px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-950/60">
                          <th className="p-4">Play Date</th>
                          <th className="p-4">Time Block</th>
                          <th className="p-4">Customer Details</th>
                          <th className="p-4 text-center">Remaining Balance</th>
                          <th className="p-4 text-right">Quick Collection</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/60 font-medium text-neutral-300">
                        {bookings.map(b => (
                          <tr key={b.id} className="hover:bg-neutral-950/40 transition">
                            <td className="p-4 text-white font-extrabold">
                              {formatDateDisplayShort(b.date)}
                            </td>
                            <td className="p-4 font-black">
                              {formatTime12h(b.start_time)} - {formatTime12h(b.end_time)}
                            </td>
                            <td className="p-4">
                              <span className="text-white font-bold uppercase block">{b.customer_name}</span>
                              <span className="text-neutral-500 text-[10px] mt-0.5 block">{b.customer_phone}</span>
                            </td>
                            <td className="p-4 text-center font-extrabold text-amber-500 text-sm">
                              ₹{b.balance_amount}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                disabled={actionLoadingId === b.id}
                                onClick={() => markBalancePaid(b.id)}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-[9px] uppercase tracking-wider rounded-none cursor-pointer"
                              >
                                {actionLoadingId === b.id ? 'Updating...' : 'Collect Cash'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cancellations' && (
              <div className="space-y-6">
                <div className="border-b border-neutral-900 pb-5">
                  <h2 className="text-xl font-black uppercase text-white tracking-tight">Cancellations & Refunds</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Past cancellations audit trail</p>
                </div>

                {bookings.length === 0 ? (
                  <div className="border border-neutral-900 p-10 bg-neutral-950/20 text-center uppercase tracking-wide">
                    <p className="text-xs font-bold text-neutral-500">Log Empty</p>
                    <p className="text-[9px] text-neutral-600 mt-1">No cancellations have been recorded</p>
                  </div>
                ) : (
                  <div className="border border-neutral-900 bg-neutral-950/20 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-neutral-900 text-[9px] text-neutral-500 uppercase font-black tracking-widest bg-neutral-950/60">
                          <th className="p-4">Customer</th>
                          <th className="p-4">Play Slot</th>
                          <th className="p-4">Cancelled At</th>
                          <th className="p-4 text-center">Window Eligibility</th>
                          <th className="p-4 text-center">Refund Value</th>
                          <th className="p-4 text-right">Refund Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/60 font-medium text-neutral-400">
                        {bookings.map(b => {
                          const isInWindow = b.cancelled_at && b.cancellation_deadline ? new Date(b.cancelled_at) <= new Date(b.cancellation_deadline) : false;
                          
                          return (
                            <tr key={b.id} className="hover:bg-neutral-950/40 transition">
                              <td className="p-4 font-bold text-white uppercase">
                                {b.customer_name}
                              </td>
                              <td className="p-4">
                                <span className="text-white block font-extrabold uppercase">{formatDateDisplayShort(b.date)}</span>
                                <span className="text-[10px] text-neutral-500 mt-0.5 block">{formatTime12h(b.start_time)} - {formatTime12h(b.end_time)}</span>
                              </td>
                              <td className="p-4 text-neutral-300">
                                {b.cancelled_at ? new Date(b.cancelled_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A'}
                              </td>
                              <td className="p-4 text-center">
                                {isInWindow ? (
                                  <span className="text-[#22c55e] text-[10px] font-bold">Refundable</span>
                                ) : (
                                  <span className="text-red-400 text-[10px] font-bold">Non-Refundable</span>
                                )}
                              </td>
                              <td className="p-4 text-center text-white font-bold">
                                ₹{b.refund_amount || 0}
                              </td>
                              <td className="p-4 text-right">
                                <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase border ${
                                  b.refund_status === 'processed' ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/30' :
                                  b.refund_status === 'pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' :
                                  'bg-neutral-800 text-neutral-500 border-neutral-700/50'
                                }`}>
                                  {b.refund_status || 'not_applicable'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="border-b border-neutral-900 pb-5">
                  <h2 className="text-xl font-black uppercase text-white tracking-tight">Turf Settings</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Configure operating limits and rates</p>
                </div>

                {settingsSuccess && (
                  <div className="p-4 border border-[#22c55e]/30 bg-[#22c55e]/5 text-[#22c55e] text-xs font-bold uppercase tracking-wider animate-fade-in">
                    {settingsSuccess}
                  </div>
                )}

                <form onSubmit={handleSettingsSave} className="border border-neutral-900 bg-neutral-950 p-6 space-y-6 max-w-2xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Turf Name</label>
                      <input
                        type="text"
                        required
                        value={turfName}
                        onChange={(e) => setTurfName(e.target.value)}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Sports Offered <span className="text-[8px] text-neutral-600 font-normal">(Comma Separated)</span></label>
                      <input
                        type="text"
                        required
                        value={sports}
                        onChange={(e) => setSports(e.target.value)}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Operating Hours Start</label>
                      <input
                        type="time"
                        required
                        value={hoursStart}
                        onChange={(e) => setHoursStart(e.target.value)}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Operating Hours End</label>
                      <input
                        type="time"
                        required
                        value={hoursEnd}
                        onChange={(e) => setHoursEnd(e.target.value)}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Slot Duration (Minutes)</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value, 10))}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      >
                        <option value={30}>30 Minutes</option>
                        <option value={60}>60 Minutes (1 Hour)</option>
                        <option value={90}>90 Minutes</option>
                        <option value={120}>120 Minutes (2 Hours)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Price Per Slot (₹)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={price}
                        onChange={(e) => setPrice(parseFloat(e.target.value))}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Online Advance Percentage (%)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        max={100}
                        value={advancePct}
                        onChange={(e) => setAdvancePct(parseInt(e.target.value, 10))}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-2">Cancellation Cutoff (Hours)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={cancelHours}
                        onChange={(e) => setCancelHours(parseInt(e.target.value, 10))}
                        className="w-full bg-[#070707] border border-neutral-900 rounded-none p-3.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-neutral-900 text-right">
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3.5 bg-[#22c55e] text-black font-black uppercase text-xs tracking-wider rounded-none shadow-[2px_2px_0px_#000] hover:bg-[#1db252] transition cursor-pointer"
                    >
                      {loading ? 'Saving...' : 'Save Settings Override'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="border-b border-neutral-900 pb-5">
                  <h2 className="text-xl font-black uppercase text-white tracking-tight">Stats & Analytics</h2>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1 font-bold">Key performance indicators</p>
                </div>

                {stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="border border-neutral-900 bg-neutral-950 p-6">
                      <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Bookings This Week</span>
                      <span className="block text-4xl font-black text-white mt-2">{stats.bookingsThisWeek}</span>
                    </div>

                    <div className="border border-neutral-900 bg-neutral-950 p-6">
                      <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Revenue Collected This Week</span>
                      <span className="block text-4xl font-black text-[#22c55e] mt-2">₹{stats.revenueThisWeek}</span>
                      <span className="text-[8px] text-neutral-600 block mt-1 uppercase font-bold">(Advance paid + Venue balance collected)</span>
                    </div>

                    <div className="border border-neutral-900 bg-neutral-950 p-6">
                      <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Bookings This Month</span>
                      <span className="block text-4xl font-black text-white mt-2">{stats.bookingsThisMonth}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-neutral-500 text-xs">No stats data found.</div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
