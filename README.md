# Admin Dashboard - PO & Vehicle Monitoring System
(No revision Yet)

A comprehensive admin dashboard built with React for managing Purchase Orders (PO), Vehicle Monitoring, Driver Information, and real-time updates across multiple devices.

##  Features

- **PO Monitoring**: Create, view, update, and delete purchase orders with detailed information
- **Vehicle Monitoring**: Track vehicle information with CRUD operations
- **Driver Management**: Admin can add drivers and monitor their status in real-time
- **Cross-Device Sync**: Real-time updates using Firebase Firestore
- **History Logging**: Complete audit trail of all actions
- **Mobile Access**: Drivers can log in from phones to update status
- **Responsive Design**: Works on desktop and mobile devices

##  Tech Stack

- **Frontend**: React.js with React Router
- **Styling**: CSS3 with modern responsive design
- **Backend**: Firebase Firestore (NoSQL database)
- **Real-time**: Firebase real-time listeners
- **Deployment**: Ready for Vercel, Netlify, or Firebase Hosting

##  Prerequisites

- Node.js (v14 or higher)
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

## 📱 Usage

### For Admin:
1. Navigate through sidebar: PO Monitoring, Vehicle Monitoring, History, Driver Info
2. Add POs/Vehicles using the floating + button
3. Click on cards to view/edit details
4. Monitor driver status in real-time

### For Drivers:
1. Access `http://[IP]:3000/driver-login` on mobile
2. Enter your name to log in
3. Confirm assignments and update vehicle status
4. Changes sync instantly to admin dashboard

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
├── components/
│   ├── Sidebar.js/css          # Navigation sidebar
├── pages/
│   ├── POMonitoring.js/css     # PO management
│   ├── VehicleMonitoring.js/css # Vehicle tracking
│   ├── DriverInfo.js/css       # Driver management
│   ├── DriverLogin.js/css      # Mobile driver login
│   └── History.js/css          # Action history
├── firebase.js                 # Firebase configuration
├── App.js/css                  # Main app component
└── index.js                    # App entry point
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

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Create Pull Request

##  License

This project is open source and available under the [MIT License](LICENSE).

## 📞 Support

For questions or issues, please open an issue on GitHub or contact the maintainer.

---

**Note**: This is a development/demo version. For production use, implement proper authentication and security measures.
