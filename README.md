# 🎓 After Hours Hub

> **A comprehensive student dashboard for DSU featuring assignment help, hostel marketplace, lost & found, esports events, real-time chat, and user profiles—all integrated into one modern platform.**

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://html.spec.whatwg.org/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://www.w3.org/Style/CSS/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-4A90A4?style=for-the-badge&logo=cloudinary&logoColor=white)](https://cloudinary.com/)

## 🌐 Live Demo

**[🚀 Try After Hours Hub Live](https://after-hours-hub.web.app/)**

> **Demo Credentials:**
> - Use Google Sign-In to access all features
> - All data is real-time and persistent
> - Feel free to create test entries

---

## 📋 Table of Contents

- [🎯 Project Overview](#-project-overview)
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [📁 Project Structure](#-project-structure)
- [🚀 Getting Started](#-getting-started)
- [🔒 Security Features](#-security-features)
- [⚡ Performance Optimizations](#-performance-optimizations)
- [📱 Responsive Design](#-responsive-design)
- [🧪 Testing](#-testing)
- [🚢 Deployment](#-deployment)
- [🛣️ Roadmap](#️-roadmap)
- [👨‍💻 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Project Overview

After Hours Hub is a modern, full-stack web application designed specifically for DSU students to streamline their academic and campus life. Built with vanilla JavaScript and Firebase, it provides a secure, real-time platform for students to collaborate, buy/sell items, manage lost & found, organize events, and communicate seamlessly.

### 🎪 What Makes It Special

- **🔥 Real-time Everything** - Live updates across all modules using Firebase
- **💬 Integrated Chat System** - Context-aware messaging for every interaction
- **🛡️ Security First** - Comprehensive CSP, input validation, and Firestore rules
- **📱 Mobile-First Design** - Responsive across all devices and screen sizes
- **⚡ Performance Optimized** - Lazy loading, efficient queries, and minimal bundle
- **🎨 Modern UI/UX** - Glass morphism design with smooth animations

---

## ✨ Features

### 🏠 **Core Dashboard**
- **Real-time Clock & Date** with automatic timezone detection
- **Theme Toggle** (Dark/Light mode) with persistent preferences
- **Global Search** with real-time filtering across all modules
- **Interactive Cards** with expand/collapse animations
- **Live Notifications** with badge counters and dropdown
- **Activity Feed** showing recent campus activity
- **Responsive Sidebar** with smooth navigation
- **Keyboard Navigation** and accessibility features

### 🔐 **Authentication & Security**
- **Firebase Authentication** with Google Sign-In
- **Content Security Policy (CSP)** implementation
- **Input Validation & Sanitization** preventing XSS attacks
- **Rate Limiting** for sensitive operations
- **Comprehensive Firestore Security Rules**
- **CSRF Protection** with token validation
- **Session Management** with automatic token refresh

### 📚 **Assignment Help Module**
- **Post Assignment Requests** with detailed forms
- **Real-time Listings** with live updates
- **Integrated Chat System** for student collaboration
- **Advanced Filtering** by subject, deadline, payment
- **Deadline Tracking** with urgency indicators
- **File Upload Support** for assignment materials
- **Author Profiles** with clickable user links

### 🛒 **Hostel Marketplace**
- **List Items for Sale** with Cloudinary image upload
- **Category-based Filtering** (Food, Daily Use, Appliances, Others)
- **Real-time Item Updates** with sold status tracking
- **Price Validation** and input sanitization
- **Seller Profiles** with user activity history
- **Chat Integration** for buyer-seller communication
- **Responsive Grid Layout** for all device sizes

### 🔍 **Lost & Found System**
- **Report Lost/Found Items** with detailed descriptions
- **Real-time Status Updates** (Open/Resolved)
- **Location Tracking** with campus area mapping
- **Advanced Filtering** by item type and status
- **Contact Integration** for item recovery
- **User Activity Tracking** across all reports
- **Dashboard Statistics** with live counts

### 🎮 **Esports & Events Management**
- **Event Creation System** with approval workflow
- **Tournament Organization** for campus esports
- **Event Categories** (Esports Tournaments, Campus Events)
- **Moderator Dashboard** for event approval
- **Real-time Event Updates** with status tracking
- **Contact Information** for event organizers
- **Participant Registration** tracking
- **Event Statistics** and analytics

### 💬 **Real-time Chat System**
- **Context-aware Messaging** (Market items, Assignments, Events)
- **Real-time Message Delivery** using Firestore listeners
- **Chat History** with persistent storage
- **Message Status** indicators (Sent, Delivered, Read)
- **User Presence** detection
- **Chat List View** with recent conversations
- **Security Features** with message sanitization

### 👤 **User Profile System**
- **Dynamic Profile Pages** (URL: `/profile.html?uid=userId`)
- **Activity Statistics** across all modules
- **Tabbed Interface** for different content types
- **Clickable User Names** throughout the application
- **Profile Pictures** with fallback avatar generation
- **Activity History** for market, assignments, events, lost & found
- **Privacy Controls** with secure data access

### 🔔 **Notification System**
- **Real-time Notifications** for all user activities
- **Badge Counters** with unread notification tracking
- **Notification Categories** (Messages, Events, Marketplace)
- **Persistent Notifications** across browser sessions
- **Click-to-Navigate** functionality
- **Notification History** with timestamp tracking

---

## 🛠️ Tech Stack

### **Frontend**
- **HTML5** - Semantic markup with accessibility features
- **CSS3** - Modern styling with CSS Grid, Flexbox, and animations
- **Vanilla JavaScript (ES6+)** - Modern JS with modules and async/await
- **Phosphor Icons** - Beautiful, consistent iconography
- **CSS Variables** - Dynamic theming support

### **Backend & Services**
- **Firebase Authentication** - Secure user management
- **Firestore Database** - NoSQL real-time database
- **Firebase Hosting** - Fast, secure web hosting
- **Cloud Functions** - Serverless backend logic
- **Firebase Analytics** - User behavior tracking

### **Third-party Integrations**
- **Cloudinary** - Image upload and optimization
- **Google OAuth** - Social authentication
- **ui-avatars.com** - Fallback avatar generation

### **Development Tools**
- **VS Code** - Primary development environment
- **Firebase CLI** - Deployment and management
- **Git** - Version control
- **Chrome DevTools** - Testing and debugging

---

## 🏗️ Architecture

### **Frontend Architecture**
```
┌─────────────────────────────────────────┐
│               User Interface            │
├─────────────────────────────────────────┤
│  Dashboard │ Market │ Chat │ Profiles   │
├─────────────────────────────────────────┤
│           JavaScript Modules            │
├─────────────────────────────────────────┤
│         Firebase SDK Integration        │
├─────────────────────────────────────────┤
│      Security Layer (CSP + Utils)      │
└─────────────────────────────────────────┘
```

### **Backend Architecture**
```
┌─────────────────────────────────────────┐
│            Firebase Hosting             │
├─────────────────────────────────────────┤
│         Firebase Authentication         │
├─────────────────────────────────────────┤
│           Firestore Database            │
│  ┌─────────┬─────────┬─────────────────┤
│  │  Users  │  Chats  │  Market Items   │
│  ├─────────┼─────────┼─────────────────┤
│  │ Events  │ L&F     │ Notifications   │
├─────────────────────────────────────────┤
│           Cloud Functions               │
├─────────────────────────────────────────┤
│        Security Rules Engine           │
└─────────────────────────────────────────┘
```

### **Data Flow**
1. **User Authentication** → Firebase Auth → User Document Creation
2. **Real-time Updates** → Firestore Listeners → UI Updates
3. **User Actions** → Security Validation → Database Write
4. **Cross-module Communication** → Event System → State Updates

---

## 📁 Project Structure

```
After-Hours-Hub/
├── 📂 src/
│   ├── 🏠 dashboard-clean.html          # Main dashboard
│   ├── 🎨 dashboard-styles.css          # Dashboard styling
│   ├── ⚡ dashboard-scripts.js          # Dashboard logic
│   │
│   ├── 📚 assign-help.html              # Assignment help page
│   ├── 📚 assign-help.js                # Assignment functionality
│   │
│   ├── 🛒 hostel-market.html            # Marketplace page
│   ├── 🛒 hostel-market.js              # Marketplace logic
│   │
│   ├── 🔍 lost-and-found.html           # Lost & found page
│   ├── 🔍 lost-and-found.js             # Lost & found logic
│   │
│   ├── 🎮 esports-and-events.html       # Events page
│   ├── 🎮 esports-and-events.js         # Events functionality
│   ├── 🎮 create-event.html             # Event creation
│   ├── 🎮 create-event.js               # Event creation logic
│   ├── 🛡️ moderate-events.html          # Moderation dashboard
│   ├── 🛡️ moderate-events.js            # Moderation logic
│   │
│   ├── 💬 chats.html                    # Chat inbox
│   ├── 💬 chats-page.js                 # Chat page logic
│   ├── 💬 chat-system.js                # Chat system core
│   ├── 💬 chat-styles.css               # Chat styling
│   ├── 🧪 chat-test.html                # Chat testing page
│   │
│   ├── 👤 profile.html                  # User profiles
│   ├── 👤 profile.js                    # Profile logic
│   │
│   ├── 🔐 login.html                    # Authentication page
│   ├── 🔥 firebase-auth.js              # Auth logic
│   ├── ⚙️ firebase-config.js            # Firebase configuration
│   ├── 🛡️ security-utils.js             # Security utilities
│   ├── 🔔 notification-system.js        # Notification system
│   │
│   └── 📄 README-organized-files.md     # Internal documentation
│
├── 📂 functions/
│   ├── 📄 index.js                      # Cloud Functions
│   └── 📦 package.json                  # Functions dependencies
│
├── ⚙️ firebase.json                     # Firebase configuration
├── 🔒 firestore.rules                   # Database security rules
├── 📊 firestore.indexes.json            # Database indexes
├── 📦 package.json                      # Project metadata
├── 🤖 robots.txt                        # SEO configuration
│
├── 📂 deployment-scripts/
│   ├── 🚀 deploy-hosting-and-rules.ps1
│   ├── 🚀 deploy-profile-system.ps1
│   ├── 🚀 deploy-security.ps1
│   └── 🚀 update-and-deploy-rules.ps1
│
└── 📂 documentation/
    ├── 📋 SECURITY-ENHANCEMENTS-SUMMARY.md
    ├── 📋 USER-PROFILE-SYSTEM.md
    ├── 📋 ESPORTS-EVENTS-IMPLEMENTATION.md
    ├── 📋 NOTIFICATION-SYSTEM-COMPLETE.md
    ├── 📋 LOST-AND-FOUND-INTEGRATION.md
    └── 📋 FIXES-APPLIED-SUMMARY.md
```

---

## 🚀 Getting Started

### **Prerequisites**
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Git for version control
- Firebase CLI (for deployment)
- Code editor (VS Code recommended)

### **Local Development Setup**

1. **Clone the Repository**
   ```bash
   git clone https://github.com/NexionisJake/After-Hours-Hub.git
   cd After-Hours-Hub
   ```

2. **Install Firebase CLI** (if not already installed)
   ```bash
   npm install -g firebase-tools
   ```

3. **Login to Firebase**
   ```bash
   firebase login
   ```

4. **Start Local Development Server**
   ```bash
   firebase serve --only hosting
   ```
   Or use VS Code Live Server extension

5. **Access the Application**
   - Open `http://localhost:5000` in your browser
   - Use Google Sign-In to authenticate
   - Explore all features in development mode

### **Firebase Project Setup** (For your own deployment)

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication, Firestore, Hosting

2. **Configure Authentication**
   - Enable Google Sign-In provider
   - Add authorized domains

3. **Set up Firestore Database**
   - Create database in production mode
   - Deploy security rules from `firestore.rules`

4. **Update Configuration**
   - Replace Firebase config in `src/firebase-config.js`
   - Update Cloudinary settings if needed

5. **Deploy**
   ```bash
   firebase deploy
   ```

---

## 🔒 Security Features

### **Content Security Policy (CSP)**
- Strict CSP headers preventing XSS attacks
- Whitelisted domains for external resources
- Nonce-based script execution where needed

### **Input Validation & Sanitization**
```javascript
// Example from security-utils.js
export function validateInput(input, maxLength = 100, allowedPattern = null) {
    const sanitized = input.trim();
    
    if (!sanitized || sanitized.length === 0) {
        return { isValid: false, error: "Input cannot be empty" };
    }
    
    if (sanitized.length > maxLength) {
        return { isValid: false, error: `Input too long (max ${maxLength} characters)` };
    }
    
    if (allowedPattern && !allowedPattern.test(sanitized)) {
        return { isValid: false, error: "Invalid characters detected" };
    }
    
    return { isValid: true, sanitizedInput: sanitized };
}
```

### **Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Market listings - users can create, everyone can read
    match /marketListings/{document} {
      allow read: if true;
      allow create: if request.auth != null && validateMarketListing(request.resource.data);
      allow update: if request.auth != null && request.auth.uid == resource.data.sellerId;
    }
    
    // More rules for other collections...
  }
}
```

### **Rate Limiting**
- Request rate limiting to prevent spam
- Message sending limits per user
- Action-specific throttling

### **Authentication Security**
- Firebase Authentication with Google OAuth
- Automatic token refresh
- Session persistence with security checks
- User role-based access control

---

## ⚡ Performance Optimizations

### **Database Optimization**
- **Efficient Queries** with proper indexing
- **Real-time Listeners** instead of polling
- **Pagination** for large data sets
- **Selective Field Retrieval** to minimize bandwidth

### **Frontend Optimization**
- **Lazy Loading** of non-critical components
- **Event Delegation** for better memory management
- **Debounced Search** to reduce API calls
- **Image Optimization** via Cloudinary
- **CSS Animation** hardware acceleration

### **Code Splitting & Modules**
- **ES6 Modules** for better tree shaking
- **Dynamic Imports** for feature-specific code
- **Modular Architecture** reducing bundle size
- **Async/Await** for non-blocking operations

### **Caching Strategy**
- **Browser Caching** for static assets
- **Service Worker** for offline support (planned)
- **Firebase Offline Support** for data persistence
- **Cloudinary CDN** for image delivery

---

## 📱 Responsive Design

### **Mobile-First Approach**
- Designed for mobile devices first
- Progressive enhancement for larger screens
- Touch-friendly interface elements
- Optimized input methods for mobile

### **Breakpoint Strategy**
```css
/* Mobile First - Base styles */
.container { padding: 1rem; }

/* Tablet */
@media (min-width: 768px) {
    .container { padding: 2rem; }
}

/* Desktop */
@media (min-width: 1024px) {
    .container { padding: 3rem; }
}

/* Large Desktop */
@media (min-width: 1440px) {
    .container { max-width: 1400px; margin: 0 auto; }
}
```

### **Responsive Features**
- **Fluid Typography** scaling with viewport
- **Flexible Grid Layouts** using CSS Grid and Flexbox
- **Adaptive Navigation** with collapsible sidebar
- **Touch Gestures** for mobile interactions
- **Viewport Optimization** for all screen sizes

---

## 🧪 Testing

### **Manual Testing Checklist**
- ✅ **Authentication Flow** - Google Sign-In works correctly
- ✅ **Real-time Updates** - Data syncs across multiple tabs/devices
- ✅ **Responsive Design** - Works on mobile, tablet, desktop
- ✅ **Form Validation** - Proper error handling and user feedback
- ✅ **Security Features** - CSP blocks unauthorized scripts
- ✅ **Performance** - Page loads under 3 seconds
- ✅ **Accessibility** - Keyboard navigation and screen readers
- ✅ **Cross-browser** - Chrome, Firefox, Safari, Edge compatibility

### **Automated Testing** (Planned)
- Unit tests for utility functions
- Integration tests for Firebase operations
- End-to-end testing with Cypress
- Performance testing with Lighthouse

### **Security Testing**
- Input sanitization validation
- XSS attack prevention
- CSRF protection verification
- Firebase security rules testing
- Rate limiting functionality

---

## 🚢 Deployment

### **Current Deployment**
- **Hosting**: Firebase Hosting
- **Database**: Firestore in production mode
- **Authentication**: Firebase Auth with Google provider
- **CDN**: Cloudinary for image assets
- **Domain**: `https://after-hours-hub.web.app/`

### **Deployment Process**
1. **Build Process** (if applicable)
   ```bash
   # No build step required for vanilla JS
   # Just ensure all files are in src/ directory
   ```

2. **Deploy to Firebase**
   ```bash
   firebase deploy --only hosting,firestore:rules,firestore:indexes
   ```

3. **Deploy Functions** (if changed)
   ```bash
   firebase deploy --only functions
   ```

4. **Verify Deployment**
   - Check console for any errors
   - Test authentication flow
   - Verify database connections
   - Test real-time features

### **Environment Configuration**
- **Development**: Local Firebase emulators
- **Staging**: Firebase project with test data
- **Production**: Live Firebase project with security rules

---

## 🛣️ Roadmap

### **Phase 1: Core Enhancements** (Q1 2024)
- [ ] **Mobile App** using Capacitor/Cordova
- [ ] **Progressive Web App** (PWA) features
- [ ] **Offline Support** with service worker
- [ ] **Push Notifications** for real-time alerts

### **Phase 2: Advanced Features** (Q2 2024)
- [ ] **AI-Powered Matching** for assignment help
- [ ] **Advanced Analytics** dashboard for admins
- [ ] **Group Chat** functionality
- [ ] **File Sharing** system with version control

### **Phase 3: Platform Expansion** (Q3 2024)
- [ ] **Multi-University Support** 
- [ ] **API Development** for third-party integrations
- [ ] **Advanced Moderation** tools with ML
- [ ] **Gamification** features and rewards

### **Phase 4: Enterprise Features** (Q4 2024)
- [ ] **Admin Dashboard** with analytics
- [ ] **Bulk Operations** for moderators
- [ ] **Advanced Reporting** and insights
- [ ] **Integration APIs** for university systems

---

## 👨‍💻 Contributing

We welcome contributions from the community! Here's how you can help:

### **How to Contribute**

1. **Fork the Repository**
   ```bash
   git fork https://github.com/NexionisJake/After-Hours-Hub.git
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make Your Changes**
   - Follow the existing code style
   - Add comments for complex logic
   - Test your changes thoroughly

4. **Commit Your Changes**
   ```bash
   git commit -m "Add: Amazing new feature"
   ```

5. **Push to Your Branch**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **Open a Pull Request**
   - Describe your changes clearly
   - Include screenshots if UI changes
   - Reference any related issues

### **Development Guidelines**

- **Code Style**: Use consistent indentation and naming conventions
- **Security**: Always validate and sanitize user inputs
- **Performance**: Consider the impact of changes on load times
- **Accessibility**: Ensure features work with keyboard navigation
- **Testing**: Test changes across different browsers and devices

### **Areas for Contribution**

- 🐛 **Bug Fixes** - Report and fix issues
- ✨ **New Features** - Implement planned roadmap items
- 📚 **Documentation** - Improve README and code comments
- 🎨 **UI/UX** - Enhance design and user experience
- 🔒 **Security** - Identify and fix security vulnerabilities
- ⚡ **Performance** - Optimize loading times and responsiveness

---

## 📄 License

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

### **License Summary**
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ No warranty provided
- ❌ No liability assumed

---

## 🙏 Acknowledgments

### **Technologies & Services**
- **Firebase** - For providing excellent backend services
- **Cloudinary** - For powerful image management
- **Phosphor Icons** - For beautiful, consistent icons
- **Google Fonts** - For typography enhancement

### **Community**
- **DSU Students** - For testing and feedback
- **Open Source Community** - For inspiration and resources
- **Firebase Community** - For tutorials and best practices

### **Special Thanks**
- All beta testers who provided valuable feedback
- Contributors who helped improve the codebase
- The Firebase team for excellent documentation

---

## 📞 Contact & Support

### **Project Maintainer**
- **Developer**: Nexion (NexionisJake)
- **GitHub**: [@NexionisJake](https://github.com/NexionisJake)
- **Project Repository**: [After-Hours-Hub](https://github.com/NexionisJake/After-Hours-Hub)

### **Getting Help**
- 🐛 **Bug Reports**: Open an issue on GitHub
- 💡 **Feature Requests**: Create a feature request issue
- 💬 **Questions**: Use GitHub Discussions
- 🔒 **Security Issues**: Email directly (see repository)

### **Project Links**
- 🌐 **Live Demo**: [https://after-hours-hub.web.app/](https://after-hours-hub.web.app/)
- 📖 **Documentation**: Available in `/docs` folder
- 🎯 **Project Board**: GitHub Projects for tracking
- 📊 **Analytics**: Firebase Analytics dashboard

---

<div align="center">

**⭐ If you found this project helpful, please give it a star! ⭐**

*Built with ❤️ for the DSU student community*

**[🚀 Try the Live Demo](https://after-hours-hub.web.app/) | [📖 Read the Docs](docs/) | [🐛 Report Issues](https://github.com/NexionisJake/After-Hours-Hub/issues)**

</div>

---

*Last Updated: January 2024 | Version: 2.0.0*
├── dashboard-clean.html      # Main dashboard HTML
├── dashboard-styles.css      # Dashboard CSS styles
├── dashboard-scripts.js      # Dashboard JS logic
├── assign-help.html          # Assignment Help page HTML
├── assign-help.js            # Assignment Help page JS
├── hostel-market.html        # Hostel marketplace HTML
├── hostel-market.js          # Hostel marketplace JS
├── firebase-auth.js          # Firebase authentication logic
├── firebase-config.js        # Centralized Firebase configuration
├── security-utils.js         # Security utilities for input validation, etc.
├── login.html                # Login page
├── README-organized-files.md # Internal documentation
```

### Configuration and Security Files
```
├── firebase.json             # Firebase project configuration
├── firestore.rules           # Security rules for Firestore
├── firestore.indexes.json    # Firestore indexes configuration
```

### Functions and Documentation
```
├── functions/                # Firebase cloud functions
│   ├── index.js              # Cloud function implementations
│   └── package.json          # Cloud functions dependencies
├── FIREBASE-SECURITY-RULES.md       # Firebase security documentation
├── FIREBASE-PERMISSION-FIX.md       # Firebase permission fix documentation
├── SECURITY-AUDIT-SUMMARY.md        # Security audit findings
├── SECURITY-ENHANCEMENTS-SUMMARY.md # Security enhancements documentation
├── SECURITY-IMPLEMENTATION-COMPLETE.md # Implementation status
```

### Legacy and Archive
```
├── old html/                 # Legacy dashboard HTML versions
```

---

## 🚀 Features

### Core Dashboard
- Real-time clock and date with automatic updates
- Theme toggle (dark/light mode) with persistent preferences
- Search with real-time filtering across all modules
- Expand/collapse interactive cards with smooth animations
- Notification dropdown with animation and realtime updates
- Responsive sidebar and layout for all screen sizes
- Progress bar and animated metrics for visual data representation
- Scroll-triggered widget/card animations for better UX
- Keyboard navigation and accessibility features
- Memory cleanup for intervals/listeners to prevent memory leaks

### Authentication & Security
- Firebase authentication with Google sign-in
- Content Security Policy (CSP) implementation for all pages
- Input validation and sanitization to prevent XSS attacks
- Rate limiting for sensitive operations
- Comprehensive Firestore security rules
- Error handling with user-friendly messages

### Assignment Help Module
- Post new assignment help requests with detailed form
- Real-time updates of assignment listings
- Chat & negotiation system between students
- Advanced filtering and sorting options
- Deadline calculation with urgency indicators
- Markdown support for assignment descriptions

### Hostel Marketplace
- List items for sale with image upload via Cloudinary
- Category-based filtering and browsing
- Mark items as sold functionality
- Interactive item cards with seller information
- Responsive grid layout for all device sizes
- Image preview before submission

### Cloud Functions
- Secure image deletion from Cloudinary
- Server-side validation for marketplace items

---

## 🛠️ Setup & Usage

### Local Development

1. **Clone the repo:**
   ```sh
   git clone https://github.com/NexionisJake/After-Hours-Hub.git
   cd After-Hours-Hub
   ```

2. **Firebase Setup:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Google Sign-In
   - Create a Firestore database
   - Update the Firebase configuration in `src/firebase-config.js` with your project credentials

3. **Cloudinary Setup (for image uploads):**
   - Create a Cloudinary account at [Cloudinary](https://cloudinary.com)
   - Set up an unsigned upload preset
   - Update the Cloudinary configuration in `src/firebase-config.js`

4. **Deploy Firebase Security Rules:**
   ```sh
   firebase deploy --only firestore:rules
   ```

5. **Local Testing:**
   - Open `src/login.html` to start with the login page
   - Or directly open `src/dashboard-clean.html` for the main dashboard
   - Open `src/assign-help.html` for the assignment help module
   - Open `src/hostel-market.html` for the marketplace

### Production Deployment

1. **Deploy to Firebase Hosting:**
   ```sh
   firebase deploy --only hosting
   ```

2. **Verify Security Rules:**
   ```sh
   firebase deploy --only firestore:rules
   ```

3. **Deploy Cloud Functions:**
   ```sh
   cd functions
   npm install
   firebase deploy --only functions
   ```

### Environment Configuration

- The application uses environment variables for sensitive API keys in cloud functions
- Configure them in the Firebase Console under Functions > Configuration

---

## 🧪 Testing

### Manual Testing Checklist
- Test all interactive elements (cards, notifications, search)
- Verify theme toggle works in both directions
- Test responsive behavior on different screen sizes
- Check keyboard navigation and accessibility
- Ensure all animations are smooth and perform well
- Verify Firebase authentication flow
- Test Cloudinary image upload functionality
- Check Firestore data reading/writing operations
- Validate form inputs and error handling

### Security Testing
- Validate Content Security Policy effectiveness
- Test input validation and sanitization
- Check Firestore security rules enforcement
- Verify authentication persistence and token refresh

---

## 🏗️ Architecture

### Frontend
- Modular HTML/CSS/JS organization with separation of concerns
- Event-driven architecture for UI interactions
- Optimized asset loading with Service Worker support

### Backend (Firebase)
- Firestore NoSQL database for scalable data storage
- Firebase Authentication for secure user management
- Cloud Functions for server-side operations
- Firestore Security Rules for data protection

### Third-party Integrations
- Cloudinary for image processing and storage
- Google OAuth for user authentication

---

## 🔒 Security Practices

- Content Security Policy (CSP) implementation
- Input sanitization to prevent XSS attacks
- Firestore security rules for data access control
- Server-side validation in Cloud Functions
- Centralized security utilities in `security-utils.js`
- Regular security audits (see `SECURITY-AUDIT-SUMMARY.md`)

---

## ⚡ Performance Optimizations

- Lazy loading of non-critical assets
- Optimized image delivery via Cloudinary
- Efficient Firestore queries with proper indexing
- DOM manipulation optimizations
- Debouncing for search operations
- Event delegation for improved event handling

---

## 📄 License

MIT

---

## � Tech Stack

- **Frontend:**
  - HTML5, CSS3, JavaScript (ES6+)
  - CSS Custom Properties for theming
  - CSS Grid and Flexbox for layouts
  - CSS Animations for UI interactions
  - Vanilla JS without heavy frameworks for optimal performance

- **Backend:**
  - Firebase (Firestore, Authentication, Cloud Functions)
  - Node.js (for Cloud Functions)

- **Storage & Media:**
  - Cloudinary for image hosting and optimization
  - Firebase Storage for user uploads

- **Security:**
  - Content Security Policy (CSP)
  - DOMPurify for sanitization
  - Firebase Security Rules

- **Development Tools:**
  - Firebase CLI for deployment
  - Firebase Emulators for local testing

---

## 🛣️ Roadmap

### Short-term Goals
- [ ] Add offline support using IndexedDB
- [ ] Implement push notifications for real-time updates
- [ ] Add progressive loading for marketplace items
- [ ] Enhance accessibility features

### Mid-term Goals
- [ ] Develop real-time collaboration features
- [ ] Add advanced analytics dashboard
- [ ] Implement a notes sharing module
- [ ] Build lost & found module with image recognition

### Long-term Goals
- [ ] Create a mobile app version using React Native
- [ ] Implement machine learning features for assignment help matching
- [ ] Add voice commands and AI assistant integration
- [ ] Build an esports tournament management system

---

## �🔄 Status

**Status:** Actively maintained. All features from the original monolithic dashboard are present and improved in this modular architecture. The codebase includes enhanced security practices and performance optimizations.
