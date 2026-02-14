#!/usr/bin/env bash
set -euo pipefail

# Embedded production target
APP_ID="d2jq3nso2igffn"
BRANCH="main"
REGION="us-east-1"

# Optional AWS profile: ./scripts/deploy_prod_backend.sh my-profile
PROFILE="${1:-}"

echo "Triggering Amplify Hosting release..."
echo "  app id : ${APP_ID}"
echo "  branch : ${BRANCH}"
echo "  region : ${REGION}"

AWS_ARGS=(--region "${REGION}")
if [[ -n "${PROFILE}" ]]; then
  AWS_ARGS+=(--profile "${PROFILE}")
fi

JOB_ID="$(
  aws amplify start-job \
    "${AWS_ARGS[@]}" \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --job-type RELEASE \
    --query "jobSummary.jobId" \
    --output text
)"

if [[ -z "${JOB_ID}" || "${JOB_ID}" == "None" ]]; then
  echo "Failed to start Amplify release job."
  exit 1
fi

echo "Started job: ${JOB_ID}"
echo "Waiting for completion..."

while true; do
  STATUS="$(
    aws amplify get-job \
      "${AWS_ARGS[@]}" \
      --app-id "${APP_ID}" \
      --branch-name "${BRANCH}" \
      --job-id "${JOB_ID}" \
      --query "job.summary.status" \
      --output text
  )"

  NOW="$(date '+%Y-%m-%d %H:%M:%S')"
  echo "[${NOW}] status: ${STATUS}"

  case "${STATUS}" in
    SUCCEED)
      echo
      echo "Amplify release completed successfully."
      break
      ;;
    FAILED | CANCELLED)
      echo
      echo "Amplify release did not succeed (status=${STATUS})."
      echo "Check Amplify Console build logs for job ${JOB_ID}."
      exit 1
      ;;
  esac

  sleep 15
done

echo
echo "Next: open the site in a private window and verify anonymous reads."
