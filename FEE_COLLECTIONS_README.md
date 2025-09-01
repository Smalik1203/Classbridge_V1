<!-- Assignments quickstart removed -->

# Fee Collections Feature

## Overview
The Fee Collections component provides comprehensive fee payment tracking and management for ClassBridge. It allows administrators to record payments, track collection progress, view student ledgers, and export data.

## Features

### 1. Payment Recording
- **Single Payment**: Record individual payments for students with detailed information
- **Bulk Upload**: Import multiple payments via CSV file
- **Payment Methods**: Support for cash, cheque, online, card, and other payment methods
- **Receipt Generation**: Automatic receipt generation with unique receipt numbers

### 2. Collection Progress Tracking
- **Real-time Statistics**: View total plan amounts, collected amounts, outstanding amounts, and collection percentages
- **Class-wise Overview**: Track collection progress by class
- **Student-level Details**: Individual student collection status
- **Component-wise Breakdown**: Track collections by fee component type

### 3. Student Ledger
- **Payment History**: Complete payment history for each student
- **Fee Plan Details**: View assigned fee components and amounts
- **Receipt Information**: Access to generated receipt numbers
- **Transaction Details**: Payment method, dates, and remarks

### 4. Data Export
- **CSV Export**: Export current view data to CSV format
- **Filtered Exports**: Export data based on selected filters
- **Comprehensive Data**: Include all relevant collection information

## Database Structure

### Tables

#### `fee_payments`
Tracks individual fee payments:
- `id`: Unique payment identifier
- `student_id`: Reference to student
- `plan_id`: Reference to fee student plan
- `component_type_id`: Reference to fee component type
- `amount_paise`: Payment amount in paise
- `payment_date`: Date of payment
- `payment_method`: Method of payment (cash, cheque, online, card, other)
- `transaction_id`: Optional transaction identifier
- `receipt_number`: Unique receipt number
- `remarks`: Optional payment remarks
- `school_code`: School identifier
- `created_by`: User who recorded the payment

#### `fee_receipts`
Generated receipts for payments:
- `id`: Unique receipt identifier
- `payment_id`: Reference to payment
- `receipt_number`: Unique receipt number (format: SCHOOLCODE/YEAR/SEQUENCE)
- `receipt_date`: Date of receipt
- `student_name`: Student's full name
- `student_code`: Student's unique code
- `class_name`: Class information
- `component_name`: Fee component name
- `amount_paise`: Payment amount in paise
- `amount_inr`: Formatted amount for receipt
- `payment_method`: Payment method
- `collected_by`: Name of person who collected payment
- `school_code`: School identifier

### Views

#### `fee_collection_summary`
Provides collection progress overview:
- Student information (name, code, class)
- Fee component details
- Plan amounts vs collected amounts
- Outstanding amounts
- Collection percentages

## Usage

### Accessing Fee Collections
1. Navigate to Fee Management
2. Select a class
3. Click "Track Collections" button
4. The Fee Collections component opens in a full-width drawer

### Recording a Payment
1. Click "Record Payment" for a specific student
2. Select the fee component
3. Enter payment amount
4. Choose payment date and method
5. Add optional transaction ID and remarks
6. Click "Record Payment"

### Bulk Upload
1. Click "Bulk Upload" button
2. Prepare CSV file with required columns:
   - `student_code`: Student's unique code
   - `component_name`: Fee component name
   - `amount`: Payment amount in INR
   - `payment_method`: Payment method
   - `payment_date`: Payment date (YYYY-MM-DD)
   - `remarks`: Optional remarks
3. Upload the CSV file
4. System processes payments and shows results

### Viewing Student Ledger
1. Click "View Ledger" for a specific student
2. View payment history and fee plan details
3. Access receipt information

### Exporting Data
1. Apply any desired filters (class, date range)
2. Click "Export CSV" button
3. Download the CSV file with current view data

## Security

### Row Level Security (RLS)
- All tables have RLS enabled
- Users can only access data from their school
- Only admins and superadmins can modify data
- Students can view their own fee information

### Permissions
- **View**: All authenticated users can view collection data from their school
- **Modify**: Only admins and superadmins can record payments and manage collections

## Technical Implementation

### Component Structure
- `FeeCollections.jsx`: Main component with all functionality
- Integrated into `FeeManage.jsx` via drawer
- Uses existing UI components and patterns

### Key Functions
- `loadCollectionData()`: Loads collection summary data
- `savePayment()`: Records individual payments
- `handleBulkUpload()`: Processes CSV uploads
- `openLedgerDrawer()`: Loads student ledger data
- `exportCurrentView()`: Exports data to CSV

### Database Functions
- `generate_receipt_number()`: Creates unique receipt numbers
- `create_fee_receipt()`: Automatically creates receipts on payment

## Error Handling
- Comprehensive error handling for all operations
- User-friendly error messages
- Graceful fallbacks for failed operations
- Validation for CSV uploads

## Performance Considerations
- Efficient database queries with proper indexing
- Client-side filtering for date ranges
- Pagination for large datasets
- Optimized data loading

## Future Enhancements
- Advanced filtering and search capabilities
- Payment reminders and notifications
- Integration with payment gateways
- Advanced reporting and analytics
- Mobile-responsive design improvements
