# Syllabus System Setup Guide

## 🎯 **Problem Solved**

The error `null value in column "academic_year_id" of relation "syllabi" violates not-null constraint` has been fixed by automatically getting the academic year from the class instance instead of requiring manual selection.

## 🔧 **How It Works Now**

### **1. Automatic Syllabus Creation**
- When you select a subject in the timetable, the system automatically creates a syllabus for that class-subject combination
- The academic year is automatically retrieved from the class instance
- No manual academic year selection required

### **2. Syllabus Management**
- **Academic Year Management**: Create and manage academic years for your school
- **Chapter Management**: Add, edit, and delete syllabus chapters for each class-subject combination

## 📋 **Setup Steps**

### **Step 1: Create Academic Years**
1. Go to **Syllabus** → **Academic Years** tab
2. Click **"Add Academic Year"**
3. Enter start year (e.g., 2025) and end year (e.g., 2026)
4. Optionally mark as active
5. Click **"Create"**

### **Step 2: Assign Academic Years to Classes**
1. Go to **Add Specific Class**
2. When creating a class instance, select the appropriate academic year
3. This links the class to the academic year

### **Step 3: Add Syllabus Chapters**
1. Go to **Syllabus** → **Syllabus Chapters** tab
2. Select a class-subject combination from the dropdown
3. Click **"Add Chapter"**
4. Enter unit number, title, description, and status
5. Click **"Create"**

### **Step 4: Use in Timetable**
1. Go to **Timetable** → **Manage** tab
2. Select a class and date
3. Add a period and select a subject
4. The system will automatically create a syllabus if it doesn't exist
5. You can optionally select a chapter for the period

## 🎯 **Key Features**

### **Automatic Syllabus Creation**
- No more manual academic year selection
- Syllabi are created automatically when needed
- Academic year is pulled from class instance

### **Progress Tracking**
- Mark chapters as pending → in progress → completed
- Real-time progress percentages
- Visual status indicators in timetable

### **Role-Based Access**
- **Superadmins**: Can manage all syllabi and academic years
- **Admins**: Can manage syllabi for their assigned classes
- **Students**: Can view timetable with progress indicators

## 🔍 **Troubleshooting**

### **"No chapters available" in timetable**
1. Go to **Syllabus** → **Syllabus Chapters**
2. Select the class-subject combination
3. Add chapters for that subject

### **"Class instance does not have an academic year assigned"**
1. Go to **Add Specific Class**
2. Edit the class instance
3. Assign an academic year to the class

### **"Academic year not found"**
1. Go to **Syllabus** → **Academic Years**
2. Create the required academic year
3. Assign it to the class instance

## 📊 **Usage Workflow**

### **For Teachers/Admins**
1. **Setup**: Create academic years and add syllabus chapters
2. **Planning**: Link chapters to timetable periods
3. **Tracking**: Update chapter status as you teach
4. **Monitoring**: View progress percentages and completion rates

### **For Students**
1. **View**: See timetable with linked chapters
2. **Track**: View progress indicators for each subject
3. **Monitor**: See completion percentages

## ✅ **What's Fixed**

- ✅ **Academic Year Constraint**: No more null value errors
- ✅ **Automatic Creation**: Syllabi created automatically
- ✅ **UI Integration**: Seamless timetable integration
- ✅ **Progress Tracking**: Real-time status updates
- ✅ **Role-Based Access**: Proper permissions for all users

The syllabus system now works seamlessly with your existing class instance structure! 🚀
