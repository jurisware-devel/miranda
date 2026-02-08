import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Spin } from "antd";
import { client } from "../logic/amplifyClient";
import { useAuth } from "../logic/auth/useAuth";
import type { UserProfileItem } from "../logic/types";

const AccountPage: React.FC = () => {
  const { profile, user, refresh } = useAuth();
  const [formState, setFormState] = useState<UserProfileItem | null>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormState(profile);
  }, [profile]);

  if (!user) {
    return null;
  }

  if (!formState) {
    return (
      <div className="auth-loading">
        <Spin />
      </div>
    );
  }

  const handleSave = async () => {
    if (!formState) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const payload = {
        userId: formState.userId,
        email: formState.email,
        name: formState.name ?? "",
        organization: formState.organization ?? "",
      };
      const result = await client.models.UserProfile.update(payload);
      if (result?.data) {
        setSuccess("Saved");
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="account-page">
      <Card className="account-card" title="Account Settings">
        {error ? <Alert type="error" message={error} showIcon /> : null}
        {success ? <Alert type="success" message={success} showIcon /> : null}
        <div className="account-form">
          <div className="account-form__row">
            <label>Email</label>
            <Input value={formState.email} disabled />
          </div>
          <div className="account-form__row">
            <label>Name</label>
            <Input
              value={formState.name ?? ""}
              onChange={(event) =>
                setFormState((prev) =>
                  prev ? { ...prev, name: event.target.value } : prev,
                )
              }
              placeholder="Optional"
            />
          </div>
          <div className="account-form__row">
            <label>Organization</label>
            <Input
              value={formState.organization ?? ""}
              onChange={(event) =>
                setFormState((prev) =>
                  prev ? { ...prev, organization: event.target.value } : prev,
                )
              }
              placeholder="Optional"
            />
          </div>
          <div className="account-form__actions">
            <Button type="primary" onClick={handleSave} loading={saving}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AccountPage;
