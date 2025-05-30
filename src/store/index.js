// src/store/index.js
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authSlice from "./slices/authSlice";
import jobsSlice from "./slices/jobsSlice";
import tasksSlice from "./slices/tasksSlice";
import contactsSlice from "./slices/contactsSlice";
import plansSlice from "./slices/plansSlice";
import analyticsSlice from "./slices/analyticsSlice";
import uiSlice from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authSlice,
    jobs: jobsSlice,
    tasks: tasksSlice,
    contacts: contactsSlice,
    plans: plansSlice,
    analytics: analyticsSlice,
    ui: uiSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore non-serializable values like Date objects in state
        ignoredActions: ["persist/PERSIST"],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

// Create a custom hook for simpler store access
export const useAppSelector = (selector) => {
  return useSelector(selector);
};

export const useAppDispatch = () => useDispatch();
