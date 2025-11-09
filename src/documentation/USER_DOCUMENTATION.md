# HILTAC Vehicle Queuing System - User Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Getting Started](#getting-started)
3. [Admin User Guide](#admin-user-guide)
4. [Driver User Guide](#driver-user-guide)
5. [Troubleshooting](#troubleshooting)
6. [Frequently Asked Questions](#frequently-asked-questions)

---

## System Overview

The HILTAC Vehicle Queuing System is a comprehensive web-based application designed to manage Purchase Orders (POs), vehicle monitoring, and delivery coordination for HILTAC Manufacturing and Trading Inc. The system supports two main user types: **Admin** and **Driver**, each with specific roles and responsibilities.

### Key Features

- **Purchase Order Management**: Create, monitor, and track purchase orders with detailed product information
- **Vehicle Monitoring**: Real-time tracking of vehicle status, capacity, and load distribution
- **Driver Management**: Monitor driver availability and status updates
- **Real-time Synchronization**: All changes sync instantly across admin and driver interfaces
- **Mobile Access**: Drivers can update status from mobile devices
- **History Logging**: Complete audit trail of all system activities
- **Advanced Load Optimization**: Sophisticated algorithm using linear programming principles for optimal vehicle assignment

### Advanced Technical Modules

#### Linear Programming-Based Load Optimization

The system employs advanced optimization algorithms inspired by linear programming to solve complex vehicle routing and load distribution problems:

**Optimization Objectives:**
- **Maximize Vehicle Utilization**: Target 70-90% capacity utilization per vehicle
- **Minimize Fleet Usage**: Use fewest vehicles possible while respecting constraints
- **Balance Load Distribution**: Avoid overloading some vehicles while underutilizing others

**Key Algorithms:**

1. **Vehicle Scoring Algorithm**
   - **Cluster Efficiency**: Prioritizes vehicles already assigned to same geographic cluster
   - **Load Efficiency**: Scores vehicles based on utilization targets (optimal: 70-90%)
   - **Size Efficiency**: Penalizes inappropriate vehicle sizes for load requirements
   - **Multi-factor Scoring**: Combines cluster, load, and size factors with weighted priorities

2. **Constraint Satisfaction**
   - **Capacity Constraints**: Hard limits on vehicle load capacity
   - **Dimension Constraints**: Physical fit requirements (length, width, height)
   - **Cluster Constraints**: Geographic routing restrictions
   - **Time Constraints**: Delivery date consistency

3. **Rebalancing Engine**
   - **10-Rule Optimization Framework**: Comprehensive rebalancing following strict business rules
   - **Bin Packing Algorithm**: Efficiently packs orders into vehicles (largest first approach)
   - **Constraint Propagation**: Ensures all assignments meet multiple criteria simultaneously

**Mathematical Formulation:**
```
Maximize: Σ(vehicle_utilization × efficiency_score)
Subject to:
- capacity_i ≥ Σ(load_j for j in vehicle_i)
- dimensions_i ≥ max(dimensions_j for j in vehicle_i)
- cluster_i = cluster_j ∀ j in vehicle_i (same date)
- date_i = date_j ∀ j in vehicle_i
- driver_status_i = "Available"
```

#### Real-Time Constraint Solver

The system implements a real-time constraint satisfaction solver that:
- **Dynamically evaluates** all possible vehicle assignments
- **Backtracks and reassigns** when constraints are violated
- **Maintains solution optimality** through continuous scoring
- **Handles conflicting constraints** by prioritizing business rules

#### Geographic Clustering System

**4-Cluster Architecture:**
- **Cluster 1**: North Luzon (Pampanga, Bulacan, Entech Pampanga)
- **Cluster 2**: Metro Manila North/East (Quezon City, BGC areas)
- **Cluster 3**: Metro Manila South/Center (Makati, Alabang, major business districts)
- **Cluster 4**: CALABARZON South (Calamba, Lipa)

**Benefits:**
- **Route Optimization**: Minimizes travel time and fuel costs
- **Capacity Planning**: Better fleet utilization within regions
- **Driver Efficiency**: Reduces cross-city travel

### User Roles

#### Admin Users
- Manage purchase orders (create, edit, delete)
- Monitor vehicle fleet and driver status
- View delivery history and system logs
- Access all system features through web dashboard

#### Driver Users
- Update vehicle status (Available, In-transit, Unavailable, Under Maintenance)
- View assigned purchase orders
- Track delivery progress
- Upload delivery photos
- Access system via mobile-friendly interface

---

## Getting Started

### System Requirements

- **Web Browser**: Modern browser (Chrome, Firefox, Safari, Edge)
- **Internet Connection**: Required for real-time synchronization
- **Mobile Device**: For driver access (optional, but recommended)

### Accessing the System

1. Open your web browser
2. Navigate to the system URL (provided by your administrator)
3. You'll be redirected to the login page

### Login Process

#### For Admin Users:
1. Click the **"Admin"** button on the login page
2. Enter username: `admin`
3. Enter password: `password`
4. Click **"Sign In"**

#### For Driver Users:
1. Click the **"Driver"** button on the login page
2. Select your name from the dropdown or type it manually
3. Enter password: `password`
4. Click **"Sign In"**

**Note**: The password is the same for all users (`password`) for simplicity. In production, individual passwords should be implemented.

### First Time Setup

After logging in, the system will automatically:
- Load your dashboard based on your user type
- Sync with the latest data from the server
- Display relevant information for your role

---

## Admin User Guide

### Dashboard Overview

After logging in as an admin, you'll see the main dashboard with a sidebar navigation:

- **PO Monitoring**: Manage purchase orders
- **Vehicle Monitoring**: View fleet status
- **History**: View system activity logs
- **Driver Info**: View driver information

### Managing Purchase Orders

#### Creating a New Purchase Order

1. Navigate to **PO Monitoring**
2. Click the **"+ Add PO"** button (floating action button)
3. Fill in the order information:
   - **PO Number**: Unique identifier for the order
   - **Company Name**: Select from dropdown (Xisco, Sodexo, Jones Lang LaSalle, etc.)
   - **Location**: Choose delivery location (filtered by company)
   - **Delivery Date**: Select delivery date (cannot be in the past)
   - **Order Date**: Date the order was placed
   - **Address**: Delivery address
   - **Contact Person**: Person to contact for delivery
   - **Phone**: Contact phone number (Philippine format)
   - **Currency**: PHP (default)
   - **Terms of Payment**: Payment terms

4. Add products to the order:
   - Click on product cards to select items
   - Choose pricing type: **Per Piece** or **Per Package**
   - Adjust quantities using +/- buttons
   - The system will suggest optimizations for better pricing

5. Review the order summary and click **"Create Purchase Order"**

#### Viewing Purchase Orders

- **Pending**: Orders waiting for vehicle assignment
- **Assigned**: Orders assigned to vehicles
- **On Hold**: Orders waiting due to no available vehicles
- **In-Transit**: Orders currently being delivered
- **Delivered**: Orders completed (awaiting confirmation)

Click on any PO card to view detailed information, edit, or delete the order.

#### Editing Purchase Orders

1. Click on a PO card
2. Click **"Update"** button
3. Modify order details or products
4. Click **"Save Changes"**

#### Deleting Purchase Orders

1. Click on a PO card
2. Click **"Delete"** button
3. Confirm deletion in the dialog

### Vehicle Monitoring

#### Viewing Fleet Status

1. Navigate to **Vehicle Monitoring**
2. View vehicle cards showing:
   - Vehicle name and plate number
   - Driver name and status
   - Load utilization (percentage and remaining capacity)
   - Status indicator (Available, In-transit, Unavailable)

3. Click on a vehicle card to see assigned POs

#### Understanding Load Distribution

- **Load Calculation**: Based on product dimensions (cm³)
- **Capacity**: Maximum load per vehicle
- **Utilization**: Current load as percentage of capacity
- **Color Coding**:
  - Green: Good utilization (≤75%)
  - Orange: High utilization (75-90%)
  - Red: Over-utilized (>90%)

### Load Rebalancing

The system includes a sophisticated **10-Rule Rebalancing Engine** that optimizes vehicle assignments:

1. Go to **PO Monitoring**
2. Click **"Rebalance Loads"** button
3. Confirm the action
4. The system will automatically redistribute POs for optimal load distribution

**Rebalancing Rules:**
- **Rule 1**: Delivery date priority (earliest dates first)
- **Rule 2**: Cluster-based assignment (no mixed clusters)
- **Rule 3**: No cross-date mixing (same date per vehicle)
- **Rule 4**: Capacity restrictions (hard limits)
- **Rule 5**: Dimension compliance (physical fit requirements)
- **Rule 6**: Auto-reassignment for oversized loads
- **Rule 7**: On-hold for conflicting cluster/date combinations
- **Rule 8**: Error handling for unassignable orders
- **Rule 9**: Full recalculation (fresh optimization)
- **Rule 10**: Final validation (ensures all rules satisfied)

**Algorithm Benefits:**
- **Optimal Utilization**: Targets 70-90% vehicle capacity
- **Constraint Satisfaction**: Respects all business rules
- **Bin Packing**: Efficiently packs orders (largest first)
- **Multi-Objective**: Balances utilization, route efficiency, and cost

### Viewing History

1. Navigate to **History**
2. View chronological list of all system activities:
   - PO creation, updates, deletions
   - Vehicle assignments
   - Driver status changes
   - Load rebalancing actions

### Driver Information

1. Navigate to **Driver Info**
2. View driver details including:
   - Contact information
   - Assigned vehicles
   - Helper information
   - Current status

---

## Driver User Guide

### Mobile Access

Drivers can access the system from mobile devices by navigating to the same URL used for admin access. The interface is optimized for mobile use.

### Driver Dashboard

After logging in, you'll see:

- **Welcome Section**: Your name, vehicle, and contact information
- **Status Update**: Change your availability status
- **Assigned POs**: List of purchase orders assigned to you
- **Theme Toggle**: Switch between light and dark modes

### Updating Vehicle Status

1. In the **"Update Vehicle Status"** section
2. Select your current status:
   - **Available**: Ready for deliveries
   - **In-transit**: Currently delivering
   - **Unavailable**: Not available for deliveries
   - **Under Maintenance**: Vehicle under maintenance
3. Click **"Update Status"**

**Important**: You cannot change status from "In-transit" until all assigned POs are marked as done.

### Managing Deliveries

#### Viewing Assigned POs

Your assigned purchase orders appear in the **"Assigned Purchase Orders"** section, sorted by completion status (incomplete first).

#### Updating Delivery Progress

For each assigned PO, you can update the delivery status:

1. **Pending** → **Depart** (when leaving for delivery)
2. **Depart** → **Ongoing** (when delivery is in progress)
3. **Ongoing** → **Mark as Done** (when delivery is complete)

**Note**: You can only mark POs as "Done" when your status is "In-transit".

#### Uploading Delivery Photos

After completing a delivery, you can upload photos as proof:

1. Click on the completed PO
2. Use the file upload option to add delivery photos
3. Photos will be stored and visible to admins

### Delivery Workflow

1. **Set Status to Available**: When ready to accept deliveries
2. **Receive Assignments**: POs are automatically assigned based on location and capacity
3. **Depart for Delivery**: Update status to "Depart" when leaving
4. **Update Progress**: Change to "Ongoing" when at delivery location
5. **Complete Delivery**: Mark as "Done" and upload photos if required
6. **Return Status**: Change back to "Available" or appropriate status

---

## Troubleshooting

### Common Issues

#### Login Problems

**Issue**: Cannot log in with correct credentials
**Solution**:
- Check if username/password is correct (admin/password for admin, driver name/password for drivers)
- Ensure internet connection is stable
- Try refreshing the page
- Clear browser cache if issues persist

**Issue**: Driver name not recognized
**Solution**: Ensure you're using your exact registered name as it appears in the system

#### Data Not Syncing

**Issue**: Changes not appearing immediately
**Solution**:
- Check internet connection
- Wait a few seconds for real-time sync
- Refresh the page if sync seems delayed
- Contact administrator if sync issues persist

#### Mobile Access Issues

**Issue**: Mobile interface not loading properly
**Solution**:
- Ensure you're using a modern mobile browser
- Try accessing from a different device
- Check network connection
- Use the full URL provided by administrator

#### PO Assignment Issues

**Issue**: POs not being assigned automatically
**Solution**:
- Check if vehicles are available and have capacity
- Verify delivery locations are in defined clusters
- Ensure drivers have "Available" status
- Check vehicle maintenance status

#### Load Calculation Errors

**Issue**: Load calculations seem incorrect
**Solution**:
- Verify product dimensions in the system
- Check packaging quantities
- Contact administrator for product data verification

### Error Messages

#### "Invalid Location"
- The delivery location is not assigned to any cluster
- Contact administrator to add the location to a cluster

#### "Insufficient Capacity"
- Selected vehicle doesn't have enough space for the order
- Try a different vehicle or split the order

#### "Cluster Conflict"
- Vehicle is already assigned to a different cluster on that date
- Choose a vehicle serving the same cluster or select a different date

#### "Cannot Change Status"
- Drivers cannot change from "In-transit" until all POs are done
- Complete all deliveries first

### Performance Issues

- **Slow Loading**: Check internet connection, try refreshing
- **Delayed Updates**: Real-time sync may take 1-2 seconds
- **Mobile Performance**: Close other apps, ensure good network signal

---

## Frequently Asked Questions

### General Questions

**Q: What is the Vehicle Queuing System?**
A: It's a web-based application that helps coordinate deliveries, manage purchase orders, and optimize vehicle utilization for HILTAC Manufacturing and Trading Inc.

**Q: Who can use the system?**
A: Admin users for management and monitoring, and authorized drivers for status updates and delivery tracking.

**Q: Is the system mobile-friendly?**
A: Yes, drivers can access it from mobile devices, and the interface adapts to different screen sizes.

**Q: How does real-time sync work?**
A: The system uses Firebase Firestore for real-time database updates, so changes appear instantly across all users.

### Admin Questions

**Q: How are vehicles automatically assigned to POs?**
A: The system uses advanced linear programming algorithms that consider vehicle capacity, driver availability, delivery location clusters, current load distribution, and multiple optimization factors for optimal assignments. The algorithm scores vehicles based on cluster efficiency, load utilization targets (70-90%), and size appropriateness.

**Q: What are clusters?**
A: Geographic groupings of delivery locations that help optimize routing and prevent vehicles from serving multiple distant areas on the same day. The system uses a 4-cluster architecture covering North Luzon, Metro Manila North/East, Metro Manila South/Center, and CALABARZON South, implementing linear programming constraints to ensure efficient route optimization.

**Q: Can I edit POs after creation?**
A: Yes, click on any PO card and select "Update" to modify details, products, or delivery information. The system will automatically trigger load rebalancing using the linear programming algorithms to ensure optimal vehicle assignments after any changes.

**Q: How do I view delivery history?**
A: Navigate to the "History" section to see all system activities chronologically. This includes automatic assignments from the optimization algorithms, manual changes, and system events.

### Driver Questions

**Q: How do I know which POs are assigned to me?**
A: Check the "Assigned Purchase Orders" section on your dashboard. POs are assigned based on your vehicle and availability.

**Q: Can I update my status from mobile?**
A: Yes, the driver dashboard is fully mobile-optimized for status updates and delivery tracking.

**Q: What happens if I forget to update my status?**
A: The system relies on accurate status updates for proper PO assignments. The optimization algorithms will not assign new POs to vehicles with unavailable drivers, and existing assignments may be automatically rebalanced if drivers become unavailable during transit.

**Q: How do I upload delivery photos?**
A: After marking a delivery as done, you can upload photos through the PO details modal. Photos are stored in Firebase Storage and help provide proof of delivery for the admin confirmation process.

### Technical Questions

**Q: What browsers are supported?**
A: Modern browsers including Chrome, Firefox, Safari, and Edge. Internet Explorer is not supported. The system requires JavaScript enabled for the optimization algorithms to function properly.

**Q: Is an internet connection required?**
A: Yes, for real-time synchronization and data access. The optimization algorithms require constant connection to Firebase for constraint solving and real-time updates. Offline functionality is not currently available.

**Q: How secure is the system?**
A: The system uses Firebase authentication and security rules with real-time constraint validation. The optimization algorithms include multiple security layers to prevent invalid assignments. Passwords are currently simplified for demo purposes, but production deployment should implement proper authentication.

**Q: Can multiple users access simultaneously?**
A: Yes, the system supports concurrent access with real-time updates across all users. The optimization algorithms handle concurrent modifications through Firebase's real-time listeners and constraint validation.

### Support

For additional support or questions not covered in this documentation:

1. Check the troubleshooting section above
2. Contact your system administrator
3. Review the History section for system activity logs
4. Ensure you're using the latest version of the application

---

**Last Updated**: November 2025
**Version**: 1.0
**System**: HILTAC Vehicle Queuing System