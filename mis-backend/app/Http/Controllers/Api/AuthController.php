<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'User is inactive'], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('web')->plainTextToken;

        $user->last_login_at = now();
        $user->save();

        return response()->json([
            'token' => $token,
            'user' => $this->authUserPayload($user),
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();

        return response()->json([
            'user' => $this->authUserPayload($user),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')
                    ->whereNull('deleted_at')
                    ->ignore($user->id),
            ],
            'phone' => ['nullable', 'string', 'max:30'],
        ]);

        $fullName = trim((string) ($data['full_name'] ?? ''));
        if ($fullName === '') {
            throw ValidationException::withMessages([
                'full_name' => ['Full name is required.'],
            ]);
        }

        $user->full_name = $fullName;
        $user->name = $fullName;
        $user->email = isset($data['email']) && trim((string) $data['email']) !== '' ? trim((string) $data['email']) : null;
        $user->phone = isset($data['phone']) && trim((string) $data['phone']) !== '' ? trim((string) $data['phone']) : null;
        $user->save();

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $this->authUserPayload($user->fresh()),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'new_password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (!Hash::check((string) $data['current_password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        if (Hash::check((string) $data['new_password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'new_password' => ['New password must be different from current password.'],
            ]);
        }

        $user->password = Hash::make((string) $data['new_password']);
        $user->save();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Logged out']);
    }

    private function authUserPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name'),
        ];
    }
}
