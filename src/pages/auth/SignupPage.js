import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import useRazorpay from "../../hooks/useRazerpay";
import AuthNavbar from "./AuthNavbar";

const API_URL = process.env.REACT_APP_API_URL;

const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { processPayment } = useRazorpay();

  const { planId, billingType = "monthly" } = location.state || {};

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [planDetails, setPlanDetails] = useState(null);
  const [isFreePlan, setIsFreePlan] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // Fetch plan details if planId is provided
  useEffect(() => {
    const fetchPlanDetails = async () => {
      if (!planId) return;

      try {
        setIsLoading(true);
        const response = await axios.get(`${API_URL}/plans/${planId}`);
        setPlanDetails(response.data.plan);

        // Check if it's a free plan
        setIsFreePlan(response.data.plan.name === "free");
      } catch (err) {
        console.error("Error fetching plan details:", err);
        setError("Unable to load plan details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanDetails();
  }, [planId]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Clear errors when user types
    if (error) setError(null);
  };

  // Inside handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Create registration data
      const registrationData = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };

      // Register user
      const response = await axios.post(
        `${API_URL}/auth/register`,
        registrationData
      );

      // Store tokens
      localStorage.setItem("token", response.data.token);
      if (response.data.refreshToken) {
        localStorage.setItem("refreshToken", response.data.refreshToken);
      }

      if (!planId || isFreePlan) {
        // Free plan or no plan specified - go directly to dashboard
        setSuccess("Account created successfully!");
        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);
      } else {
        // Paid plan - proceed to payment step
        setStep(2);

        // Create a payment order
        const orderResponse = await axios.post(
          `${API_URL}/payments/create-order`,
          { planId, billingType },
          { headers: { Authorization: `Bearer ${response.data.token}` } }
        );
        console.log(orderResponse.data);

        setPaymentData(orderResponse.data);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Add this function to handle payment failure
  const handleSkipPayment = () => {
    setSuccess("Account created with free plan. You can upgrade later.");
    setTimeout(() => {
      navigate("/dashboard");
    }, 1500);
  };

  // Handle payment process
  // Updated handlePayment function
  const handlePayment = async () => {
    if (!paymentData) {
      setError("Payment data not available");
      return;
    }

    try {
      setIsPaymentProcessing(true);
      setError(null);

      // Process payment with Razorpay
      const paymentResponse = await processPayment(paymentData, {
        name: formData.name,
        email: formData.email,
      });

      // Verify payment with backend only if we get a valid response from Razorpay
      if (
        paymentResponse &&
        paymentResponse.razorpay_order_id &&
        paymentResponse.razorpay_payment_id &&
        paymentResponse.razorpay_signature
      ) {
        const verificationData = {
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
          transactionId: paymentData.transaction,
        };

        try {
          await axios.post(`${API_URL}/payments/verify`, verificationData, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });

          // Show success message and redirect to dashboard
          setSuccess("Payment successful! Your account has been set up.");
          setTimeout(() => {
            navigate("/dashboard");
          }, 1500);
        } catch (verificationErr) {
          console.error("Payment verification error:", verificationErr);
          setError(
            "Payment verification failed. You can try again or continue with the free plan."
          );
        }
      } else {
        // If Razorpay response is incomplete, show an error
        setError(
          "Payment process was interrupted. You can try again or continue with the free plan."
        );
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(
        err.message ||
          "Payment failed. Please try again or continue with the free plan."
      );
    } finally {
      setIsPaymentProcessing(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  return (
    <>
      <AuthNavbar />
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {step === 1 ? "Create your account" : "Complete your subscription"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 1 ? (
              <>
                Or{" "}
                <a
                  href="/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  sign in to your existing account
                </a>
              </>
            ) : (
              "Set up your plan and payment details"
            )}
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            {/* Error message */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative">
                {error}
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded relative">
                {success}
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <>
                {/* Step 1: Account Creation */}
                {step === 1 && (
                  <form className="space-y-6" onSubmit={handleSubmit}>
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Full Name
                      </label>
                      <div className="mt-1">
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={formData.name}
                          onChange={handleChange}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Email address
                      </label>
                      <div className="mt-1">
                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={formData.email}
                          onChange={handleChange}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Password
                      </label>
                      <div className="mt-1">
                        <input
                          id="password"
                          name="password"
                          type="password"
                          autoComplete="new-password"
                          required
                          value={formData.password}
                          onChange={handleChange}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          minLength="6"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmPassword"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Confirm Password
                      </label>
                      <div className="mt-1">
                        <input
                          id="confirmPassword"
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          required
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          minLength="6"
                        />
                      </div>
                    </div>

                    {/* Display selected plan if available */}
                    {planDetails && (
                      <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-sm font-medium text-gray-700">
                          Selected Plan
                        </h3>
                        <div className="mt-2 flex justify-between">
                          <span className="text-sm text-gray-500">
                            {planDetails.name.charAt(0).toUpperCase() +
                              planDetails.name.slice(1)}{" "}
                            Plan
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {planDetails.name === "free"
                              ? "Free"
                              : `${formatCurrency(
                                  billingType === "monthly"
                                    ? planDetails.price.monthly
                                    : planDetails.price.yearly
                                )}/${billingType}`}
                          </span>
                        </div>
                      </div>
                    )}

                    <div>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        {isLoading ? "Processing..." : "Create Account"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 2: Payment */}
                {step === 2 && paymentData && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h3 className="text-sm font-medium text-gray-700">
                        Order Summary
                      </h3>
                      <div className="mt-2 space-y-2">
                        {/* Plan name and type */}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Plan:</span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {planDetails?.name || "Premium"} Plan
                          </span>
                        </div>

                        {/* Billing frequency */}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">
                            Billing:
                          </span>
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {billingType}
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                          <span className="text-sm text-gray-500">Amount:</span>
                          <span className="text-sm font-medium text-gray-900">
                            {formatCurrency(
                              paymentData.order.amount / 100,
                              paymentData.order.currency
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <button
                        onClick={handlePayment}
                        disabled={isPaymentProcessing}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
                      >
                        {isPaymentProcessing
                          ? "Processing..."
                          : "Complete Payment"}
                      </button>

                      {/* Keep the free plan button always enabled */}
                      <button
                        onClick={handleSkipPayment}
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Continue with Free Plan
                      </button>
                    </div>

                    {error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                        {error}
                        <p className="mt-1">
                          You can try again or continue with the free plan.
                        </p>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-4">
                      By completing your purchase, you agree to our Terms of
                      Service and Privacy Policy.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SignupPage;
