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
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = User::query()
            ->with('customer:id,uuid,name')
            ->where('email', $request->email)
            ->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (($user->status ?? 'active') !== 'active') {
            return response()->json(['message' => 'User is inactive'], 403);
        }

        $deviceName = trim((string) ($request->input('device_name') ?: 'web'));
        $user->tokens()->where('name', $deviceName)->delete();
        $token = $user->createToken($deviceName)->plainTextToken;

        $user->last_login_at = now();
        $user->save();

        return response()->json([
            'token' => $token,
            'user' => $this->authUserPayload($user->fresh()->loadMissing('customer:id,uuid,name')),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $this->authUserPayload($user->loadMissing('customer:id,uuid,name')),
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
            'user' => $this->authUserPayload($user->fresh()->loadMissing('customer:id,uuid,name')),
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

        if (! Hash::check((string) $data['current_password'], (string) $user->password)) {
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

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out',
        ]);
    }

    private function authUserPayload(User $user): array
    {
        $user->loadMissing('customer:id,uuid,name');

        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'customer_id' => $user->customer_id,
            'customer_uuid' => $user->customer?->uuid,
            'customer_name' => $user->customer?->name,
            'roles' => $user->getRoleNames()->values()->all(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
        ];
    }
}
