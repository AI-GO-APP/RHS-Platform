/**
 * 預約 / 委託 API 模組
 * 使用 crm_leads 系統表（Ext Proxy，需登入）
 * 
 * 資料映射：
 * ┌─────────────────────────────────────────────────────────┐
 * │ crm_leads                                               │
 * │  type: 'lead' (初始) / 'opportunity' (確認)              │
 * │  name: 案件標題                                          │
 * │  contact_name: 聯絡人姓名                                │
 * │  phone: 聯絡電話                                         │
 * │  email_from: Email                                       │
 * │  priority: 0-3                                           │
 * │  custom_data: {                                          │
 * │    app_domain: 'rhs-platform',                           │
 * │    lead_category: 'tenant_booking' | 'landlord_commission'│
 * │    property_id, property_title,                          │
 * │    preferred_time, booking_status,                       │
 * │    property_address, property_size, ...                  │
 * │  }                                                       │
 * └─────────────────────────────────────────────────────────┘
 */
import { EXT_PROXY_PREFIX } from './config.js';
import { authedRequest } from './auth.js';
import { withDomain, domainFilter } from './domain.js';

/**
 * 建立賞屋預約（租客端）
 */
export async function createBooking({ propertyId, propertyTitle, contactName, phone, email, preferredTime }) {
  return authedRequest('POST', `${EXT_PROXY_PREFIX}/crm_leads`, {
    type: 'lead',
    name: `賞屋預約 - ${propertyTitle}`,
    contact_name: contactName,
    phone: phone,
    email_from: email,
    custom_data: withDomain({
      lead_category: 'tenant_booking',
      property_id: propertyId,
      property_title: propertyTitle,
      preferred_time: preferredTime,
      booking_status: 'pending',
    }),
  });
}

/**
 * 取得我的預約列表（租客端）
 */
export async function fetchMyBookings() {
  const r = await authedRequest('POST', `${EXT_PROXY_PREFIX}/crm_leads/query`, {
    filters: [
      { column: 'custom_data', op: 'ilike', value: '%tenant_booking%' },
      domainFilter(),
    ],
    order_by: [{ column: 'created_at', direction: 'desc' }],
    limit: 50,
  });

  if (r.ok && Array.isArray(r.data)) {
    return { ok: true, data: r.data.map(transformBooking) };
  }
  return r;
}

/**
 * 建立房屋委託（房東端）
 */
export async function createCommission({ contactName, phone, email, propertyAddress, propertySize, currentCondition, expectedRent }) {
  return authedRequest('POST', `${EXT_PROXY_PREFIX}/crm_leads`, {
    type: 'lead',
    name: `房屋委託 - ${propertyAddress}`,
    contact_name: contactName,
    phone: phone,
    email_from: email,
    custom_data: withDomain({
      lead_category: 'landlord_commission',
      property_address: propertyAddress,
      property_size: propertySize,
      current_condition: currentCondition,
      expected_rent: expectedRent,
      commission_status: 'evaluating',
    }),
  });
}

/**
 * 轉換 crm_lead 為前端預約格式
 */
function transformBooking(lead) {
  const cd = (typeof lead.custom_data === 'string') ? JSON.parse(lead.custom_data) : (lead.custom_data || {});
  return {
    id: lead.id,
    name: lead.name,
    type: lead.type,
    contactName: lead.contact_name,
    phone: lead.phone,
    email: lead.email_from,
    propertyId: cd.property_id,
    propertyTitle: cd.property_title,
    preferredTime: cd.preferred_time,
    bookingStatus: cd.booking_status || 'pending',
    leadCategory: cd.lead_category,
    createdAt: lead.created_at,
  };
}
