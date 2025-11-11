# HILTAC AUTOMATED DELIVERY ALLOCATION SYSTEM
**Intelligent Delivery Optimization & Fleet Management Platform**

A comprehensive web-based application built with React for managing Purchase Orders (PO), Vehicle Monitoring, Driver Information, and real-time updates across multiple devices. Features advanced linear programming algorithms for optimal load distribution and constraint-based vehicle assignment.

##  Key Features

### Core Functionality
- **PO Monitoring**: Create, view, update, and delete purchase orders with detailed information
- **Vehicle Monitoring**: Track vehicle information with CRUD operations
- **Driver Management**: Admin can add drivers and monitor their status in real-time
- **Cross-Device Sync**: Real-time updates using Firebase Firestore
- **History Logging**: Complete audit trail of all actions
- **Mobile Access**: Drivers can log in from phones to update status
- **Responsive Design**: Works on desktop and mobile devices

### Advanced Optimization Features
- ** Linear Programming Algorithms**: Sophisticated load distribution optimization
- ** Multi-Objective Optimization**: Balances utilization, cost, and efficiency
- ** Constraint Satisfaction Solver**: Real-time validation of capacity, dimension, and cluster constraints
- ** 10-Rule Rebalancing Engine**: Comprehensive load redistribution with business rule compliance
- ** Geographic Clustering System**: 4-cluster architecture for route optimization
- ** Real-Time Constraint Validation**: Instant feedback on assignment feasibility
- ** Forecasting System**: Predictive analytics for delivery planning and resource allocation

##  Tech Stack

### Frontend & UI
- **React.js (v19.1.1)** with React Router (v7.9.1) for component-based architecture
- **CSS3** with modern responsive design and CSS Grid/Flexbox
- **Material Design** inspired UI components with custom theming

### Backend & Database
- **Firebase Firestore (v12.3.0)** (NoSQL database) for real-time data synchronization
- **Firebase Authentication** for secure user management

### Advanced Algorithms & Optimization
- **Linear Programming** inspired constraint satisfaction algorithms
- **Multi-objective optimization** for load distribution
- **Real-time constraint validation** with backtracking
- **Bin packing algorithms** for efficient space utilization
- **Geographic clustering** with route optimization

### Real-time Features
- **Firebase real-time listeners** for instant cross-device sync
- **WebSocket-based updates** for live dashboard monitoring
- **Optimistic UI updates** with conflict resolution

### Deployment & DevOps
- **Ready for Vercel, Netlify, or Firebase Hosting**
- **Progressive Web App (PWA)** capabilities
- **Mobile-first responsive design**
- **Cross-browser compatibility** (Chrome, Firefox, Safari, Edge)

##  Prerequisites

- Node.js (v18.17 or higher)
- npm or yarn
- Firebase account (for database)

##  Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/Faranxis524/Vehicle-Queuing.git
   cd Vehicle-Queuing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore Database
   - Update `src/firebase.js` with your Firebase config
   - Set Firestore rules to allow read/write (for development)

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Access the application**
   - Admin Dashboard: `http://localhost:3000`
   - Driver Login: `http://localhost:3000/driver-login`
   - Network Access: `http://[YOUR_IP]:3000` (for mobile testing)

### Development Utilities
- **Clear Firebase Data**: Run `node clearFirebase.js` to reset the database and initialize sample driver data for testing

## 📱 Usage Guide

### For Admin Users:
1. **Login**: Use admin credentials (username: `admin`, password: `password`)
2. **Dashboard Navigation**: Use sidebar to access PO Monitoring, Vehicle Monitoring, History, Driver Info
3. **PO Management**: Click floating "+" button to create orders, click cards to view/edit details
4. **Load Optimization**: Use "Rebalance Loads" for automatic optimization using linear programming algorithms
5. **Real-time Monitoring**: Track driver status and vehicle utilization in real-time

### For Driver Users:
1. **Mobile Login**: Access `http://[IP]:3000/driver-login` on mobile devices
2. **Authentication**: Enter driver name with password `password`
   - **Authorized Drivers**:
     - Fernando Besa
     - Joseph Allan Saldivar
     - Randy Maduro
     - Adrian Silao
3. **Status Updates**: Update vehicle status (Available, In-transit, Unavailable, Under Maintenance)
4. **Delivery Tracking**: Mark POs as Depart → Ongoing → Done
5. **Real-time Sync**: All changes instantly reflect on admin dashboard

### Advanced Features:
- **Automatic Assignment**: System uses constraint satisfaction algorithms for optimal vehicle assignments
- **Load Rebalancing**: 10-rule optimization engine redistributes loads for maximum efficiency
- **Geographic Optimization**: 4-cluster system minimizes travel time and maximizes route efficiency
- **Constraint Validation**: Real-time checking of capacity, dimensions, and cluster restrictions

##  Configuration

### Firebase Setup
1. Create project at Firebase Console
2. Enable Firestore Database
3. Update `src/firebase.js` with your config:
   ```javascript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     // ... other config
   };
   ```

4. Set Firestore Security Rules (for development):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```

##  Project Structure

```
src/
├── components/                    # Reusable UI components
│   ├── Sidebar.js/css            # Navigation sidebar with role-based access
│   ├── NotificationDialog.js/css # Toast notifications and alerts
│   ├── ConfirmDialog.js/css      # Confirmation dialogs
│   ├── Dialog.js/css             # Modal dialog system
│   ├── ErrorBoundary.js          # Error handling wrapper
│   └── ProtectedRoute.js         # Route protection based on user roles
├── contexts/                     # React Context for state management
│   ├── AuthContext.js            # User authentication state
│   ├── VehicleContext.js         # Vehicle and optimization logic
│   └── VehicleContext.test.js    # Unit tests for vehicle algorithms
├── pages/                        # Main application pages
│   ├── POMonitoring.js/css       # PO management with optimization
│   ├── VehicleMonitoring.js/css  # Fleet monitoring dashboard
│   ├── DriverDashboard.js/css    # Mobile driver interface
│   ├── DriverInfo.js/css         # Driver management and info
│   ├── DriverLogin.js/css        # Mobile authentication
│   ├── History.js/css            # Audit trail and activity log
│   └── CentralLogin.js           # Unified login system
├── documentation/                # Technical documentation
│   ├── USER_DOCUMENTATION.md     # Comprehensive user guide
│   └── REBALANCE_IMPLEMENTATION.md # Algorithm implementation details
├── firebase.js                   # Firebase configuration and setup
├── App.js/css                    # Main application component with routing
└── index.js                      # Application entry point
clearFirebase.js                  # Development utility to clear and initialize Firebase data
```

##  Deployment

### For Production:
1. Build the app: `npm run build`
2. Deploy to hosting service (Vercel, Netlify, Firebase Hosting)
3. Update Firebase security rules for production

### Environment Variables:
Create `.env` file for sensitive config:
```
REACT_APP_FIREBASE_API_KEY=your_key
REACT_APP_FIREBASE_PROJECT_ID=your_project
```

##  Contributing

We welcome contributions to improve the HILTAC AUTOMATED DELIVERY ALLOCATION SYSTEM! Please follow these guidelines:

### Development Setup
1. **Fork the repository** on GitHub
2. **Clone your fork**: `git clone https://github.com/your-username/Vehicle-Queuing.git`
3. **Create feature branch**: `git checkout -b feature/your-feature-name`
4. **Install dependencies**: `npm install`
5. **Start development server**: `npm start`

### Code Guidelines
- **Algorithm Changes**: Update documentation in `src/documentation/REBALANCE_IMPLEMENTATION.md`
- **UI Components**: Follow existing design patterns and responsive principles
- **Testing**: Add tests for new algorithms in `src/contexts/VehicleContext.test.js`
- **Documentation**: Update user documentation for new features

### Contribution Process
1. **Write clear commit messages** describing algorithm changes or feature additions
2. **Test thoroughly** - especially optimization algorithms with various scenarios
3. **Update documentation** - both user guide and technical specifications
4. **Create Pull Request** with detailed description of changes
5. **Code Review** - ensure algorithm correctness and performance

### Areas for Contribution
- **Algorithm Optimization**: Improve constraint satisfaction or scoring algorithms
- **UI/UX Enhancements**: Better mobile experience or accessibility
- **Additional Constraints**: New business rules or optimization objectives
- **Performance Monitoring**: Algorithm performance metrics and analytics
- **Testing**: Comprehensive test suites for optimization scenarios

##  License

This project is open source and available under the [MIT License](LICENSE).

##  Documentation

### User Documentation
- **[ Complete User Guide](src/documentation/USER_DOCUMENTATION.md)**: Comprehensive tutorial for admins and drivers
- **Features**: Step-by-step instructions, troubleshooting, and FAQ
- **Technical Details**: Algorithm explanations and optimization features

### Technical Documentation
- **[ Rebalance Implementation](src/documentation/REBALANCE_IMPLEMENTATION.md)**: Detailed algorithm specifications
- **10-Rule Framework**: Complete optimization rule documentation
- **Performance Metrics**: Algorithm complexity and testing recommendations

##  Support & Resources

### Getting Help
- ** User Documentation**: Start with the comprehensive user guide
- ** Issue Reporting**: Open issues on GitHub for bugs and feature requests
- ** Technical Support**: Contact maintainers for implementation questions

### Key Resources
- **Algorithm Documentation**: Understanding the optimization engine
- **API References**: Firebase integration and data models
- **Deployment Guides**: Production setup and security configurations

---

##  Important Notes

### Development Version
This is a development/demo version with simplified authentication for testing purposes.

### Production Deployment Requirements
- **Enhanced Security**: Implement proper authentication and authorization
- **Database Security**: Configure production Firestore security rules
- **Environment Variables**: Use secure configuration management
- **Monitoring**: Set up logging and performance monitoring

### Algorithm Performance
- **Optimization Scope**: Designed for fleets of 4-20 vehicles
- **Real-time Processing**: Handles concurrent users and live updates
- **Constraint Validation**: Ensures business rule compliance across all operations

---
