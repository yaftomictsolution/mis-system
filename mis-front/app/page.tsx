'use client'

import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '../src/store/store'
import { increment, decrement } from '../src/store/counterSlice'

export default function Home() {
  const dispatch = useDispatch<AppDispatch>()
  const count = useSelector((state: RootState) => state.counter.value)

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Department Management System
            </h2>
            <form className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">Email</label>
                <input
                  type="email"
                  className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
    
              <div>
                <label className="text-sm text-gray-600">Password</label>
                <input
                  type="password"
                  className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
    
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold">
                Login
              </button>
            </form>
    
            <p className="text-center text-sm text-gray-500 mt-4">
              Don’t have an account? <span className="text-blue-600 cursor-pointer">Register</span>
            </p>
          </div>
        </div>
      );
    }

