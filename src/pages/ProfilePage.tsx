import { useEffect, useState } from "react";
import type { Schema } from "../../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Alert, Button, Form, Input, Space, Typography } from "antd";

const client = generateClient<Schema>();

export default function ProfilePage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileForm] = Form.useForm();

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const { data } = await client.models.Profile.list({ limit: 1 });
        if (!active) return;
        const profile = data?.[0];
        if (profile) {
          setProfileId(profile.id);
          profileForm.setFieldsValue({
            displayName: profile.displayName ?? "",
            bio: profile.bio ?? "",
            avatarUrl: profile.avatarUrl ?? "",
          });
        }
        setProfileError(null);
      } catch (err) {
        if (active) {
          setProfileError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (active) setProfileLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, [profileForm]);

  async function saveProfile() {
    try {
      setProfileSaving(true);
      const values = await profileForm.validateFields();
      if (profileId) {
        const { data } = await client.models.Profile.update({
          id: profileId,
          displayName: values.displayName || null,
          bio: values.bio || null,
          avatarUrl: values.avatarUrl || null,
        });
        if (data?.id) setProfileId(data.id);
      } else {
        const { data } = await client.models.Profile.create({
          displayName: values.displayName || null,
          bio: values.bio || null,
          avatarUrl: values.avatarUrl || null,
        });
        if (data?.id) setProfileId(data.id);
      }
      setProfileError(null);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={2} style={{ margin: 0 }}>
        My Profile
      </Typography.Title>
      {profileError ? (
        <Alert type="error" message="Profile error" description={profileError} />
      ) : null}
      <Form
        form={profileForm}
        layout="vertical"
        requiredMark={false}
        disabled={profileLoading || profileSaving}
      >
        <Form.Item label="Display name" name="displayName">
          <Input placeholder="Jane Doe" />
        </Form.Item>
        <Form.Item label="Bio" name="bio">
          <Input.TextArea rows={3} placeholder="Short bio" />
        </Form.Item>
        <Form.Item label="Avatar URL" name="avatarUrl">
          <Input placeholder="https://example.com/avatar.png" />
        </Form.Item>
      </Form>
      <Button type="primary" onClick={saveProfile} loading={profileSaving}>
        Save profile
      </Button>
    </Space>
  );
}
